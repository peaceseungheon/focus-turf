// Hermes의 TextDecoder는 utf-8 계열 라벨만 지원한다. h3-js(v4) dist에 내장된
// emscripten 글루가 모듈 평가 시점에 `new TextDecoder('utf-16le')`를 생성하고
//(libh3-browser), 이때 RangeError: Unknown encoding: utf-16le (normalized: utf-16le)가
// 발생한다. 모든 번들 모듈보다 먼저 평가되도록 index.ts 최상단에서 import한다.
// utf-16 계열 라벨만 우리 구현으로 대체하고 나머지 라벨은 원래 구현에 위임한다.
// h3-js가 UTF-16 디코딩을 실제로 사용하는 코드 경로는 없으므로 하위 호환 디코딩만 제공한다.
const NativeTextDecoder: typeof TextDecoder = globalThis.TextDecoder;

const UTF16_LABEL = /^\s*utf-?16/i;

class HermesSafeTextDecoder extends NativeTextDecoder {
  private readonly isUtf16: boolean;

  constructor(label: string = 'utf-8', options?: TextDecoderOptions) {
    if (UTF16_LABEL.test(label)) {
      // Hermes가 지원하는 라벨로 부모를 초기화하고, 디코딩만 우리 구현으로 우회한다.
      super('utf-8', options);
      this.isUtf16 = true;
    } else {
      super(label, options);
      this.isUtf16 = false;
    }
  }

  decode(input?: BufferSource, options?: TextDecodeOptions): string {
    if (!this.isUtf16) {
      return super.decode(input, options);
    }
    if (input == null) {
      return '';
    }
    const bytes =
      input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let result = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = bytes[i] | (bytes[i + 1] << 8);
      if (code !== 0) {
        result += String.fromCharCode(code);
      }
    }
    return result;
  }
}

globalThis.TextDecoder = HermesSafeTextDecoder;
