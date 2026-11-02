// ============================================================
// faqs.ts — Per-tool FAQ content
// Rendered as a visible FAQ section and FAQPage JSON-LD by ToolLayout.
// Every tool registered in tools.ts must have an entry (enforced in tests).
// ============================================================

export interface ToolFaq {
  question: string;
  answer: string;
}

const PRIVACY_ANSWER =
  'No. Everything runs locally in your browser. Your input is never uploaded, stored, or sent to any server.';

export const TOOL_FAQS: Record<string, ToolFaq[]> = {
  // ── JSON ──────────────────────────────────────────────────
  'json-formatter': [
    {
      question: 'How do I format or beautify JSON?',
      answer:
        'Paste your JSON into the input editor and choose Format / Prettify. The output is indented with your chosen indent size, and any syntax error is reported with its position so you can fix it quickly.',
    },
    {
      question: 'Can it fix invalid JSON?',
      answer:
        'Yes. Auto Repair fixes common problems such as single quotes, unquoted keys, trailing commas, comments, and JavaScript-style values like undefined or NaN, then returns valid JSON.',
    },
    {
      question: 'How do I minify JSON?',
      answer:
        'Choose Minify to strip all unnecessary whitespace and line breaks. The result is a single-line JSON string with the same data, ideal for payloads and config values.',
    },
    {
      question: 'What do Escape String and Unescape do?',
      answer:
        'Escape String converts JSON into an escaped string literal (quotes become \\" and newlines become \\n) so it can be embedded inside another string. Unescape reverses the process.',
    },
    { question: 'Is my JSON sent to a server?', answer: PRIVACY_ANSWER },
  ],
  'json-diff': [
    {
      question: 'How do I compare two JSON documents?',
      answer:
        'Paste the original JSON on the left and the modified JSON on the right, then choose Compare JSON. The result tree marks every key as added, removed, changed, or unchanged.',
    },
    {
      question: 'Does key order affect the comparison?',
      answer:
        'No. Objects are compared key by key, so the same keys in a different order are treated as identical. Arrays are compared by index, because order matters in JSON arrays.',
    },
    {
      question: 'Can I compare minified and formatted JSON?',
      answer:
        'Yes. Both sides are parsed before comparing, so whitespace and formatting differences are ignored and only real data changes are reported.',
    },
    {
      question: 'What happens when a value changes type?',
      answer:
        'A key whose value changes type, for example from a string to a number or from an array to an object, is reported as changed with both the old and new values shown.',
    },
    { question: 'Is my JSON uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],

  // ── Lottie ────────────────────────────────────────────────
  'lottie-player': [
    {
      question: 'How do I preview a Lottie animation online?',
      answer:
        'Upload a Lottie .json or .lottie file, or paste the Bodymovin JSON into the editor. The animation plays instantly, and you can control speed, looping, direction, and switch between the SVG and Canvas renderers.',
    },
    {
      question: 'Can I change the colors of a Lottie animation?',
      answer:
        'Yes. The Colors panel lists every fill, stroke, and solid color used in the animation. Pick a color to replace it everywhere, then download the updated JSON.',
    },
    {
      question: 'Does the player support .lottie (dotLottie) files?',
      answer:
        'Yes. dotLottie archives are unpacked in your browser, and any bundled images or audio are inlined so the animation plays exactly as packaged.',
    },
    {
      question: 'Are After Effects expressions supported?',
      answer:
        'No. Expressions are JavaScript embedded in the file, so they are deliberately not executed for your safety. Animations that rely on expressions play using their static values.',
    },
    { question: 'Is my animation uploaded to a server?', answer: PRIVACY_ANSWER },
  ],
  'lottie-converter': [
    {
      question: 'What is a .lottie (dotLottie) file?',
      answer:
        'dotLottie is a ZIP-based format that packages Lottie JSON together with its images and a manifest. It is usually much smaller than the raw JSON and is supported by the official Lottie players.',
    },
    {
      question: 'How do I convert Lottie JSON to .lottie?',
      answer:
        'Paste or upload your Lottie JSON, optionally set the animation ID, playback speed, and looping, then download the compressed .lottie archive. The size reduction is shown before you download.',
    },
    {
      question: 'How do I extract JSON from a .lottie file?',
      answer:
        'Switch to .lottie → JSON and upload the archive. The animation JSON is extracted with any bundled images inlined as data URIs, and you can copy or download it as pretty or minified JSON.',
    },
    { question: 'Are my files uploaded during conversion?', answer: PRIVACY_ANSWER },
  ],
  'lottie-validator': [
    {
      question: 'What does the Lottie validator check?',
      answer:
        'It checks the Bodymovin structure: required root properties, frame rate and frame ranges, layer types and parenting, asset references, and other issues that make animations fail or render incorrectly on web and mobile players.',
    },
    {
      question: 'What is the difference between errors, warnings, and info?',
      answer:
        'Errors are likely to break playback, warnings may cause rendering differences across players, and info items are suggestions. Use the filter tabs to focus on one severity.',
    },
    {
      question: 'What should I do if my Lottie JSON is not valid JSON?',
      answer:
        'Send it to the JSON Formatter with the Repair action to fix syntax problems such as trailing commas or comments, then validate it again.',
    },
    { question: 'Is my animation sent to a server for validation?', answer: PRIVACY_ANSWER },
  ],
  'lottie-optimizer': [
    {
      question: 'How does the Lottie optimizer reduce file size?',
      answer:
        'It rounds keyframe values to a chosen decimal precision, minifies whitespace, and can optionally remove editor layer names, markers, and hidden layers. Timing values are kept exact so playback does not drift.',
    },
    {
      question: 'Will optimizing change how my animation looks?',
      answer:
        'The default settings are conservative and visually lossless. A side-by-side preview of the original and optimized animation lets you confirm the result before downloading.',
    },
    {
      question: 'When should I not remove hidden layers?',
      answer:
        'Keep hidden layers if your app toggles their visibility at runtime with code. Otherwise they only add weight and are safe to remove.',
    },
    {
      question: 'Can I see exactly what changed?',
      answer:
        'Yes. Compare in JSON Diff opens the original and optimized JSON side by side, and the result can be downloaded as JSON or as a compressed .lottie file.',
    },
    { question: 'Is my animation uploaded to optimize it?', answer: PRIVACY_ANSWER },
  ],

  // ── QR ────────────────────────────────────────────────────
  'qr-generator': [
    {
      question: 'What can I encode in a QR code?',
      answer:
        'You can create QR codes for a URL or link, plain text or notes, and WiFi networks, so people can join your network by scanning instead of typing the password.',
    },
    {
      question: 'What is the error correction level?',
      answer:
        'Error correction lets a QR code stay scannable when part of it is damaged or covered. Higher levels are more robust but produce denser codes; Medium is a good default.',
    },
    {
      question: 'Can I change the QR code colors?',
      answer:
        'Yes. Set the pattern (dark) and background (light) colors. Keep strong contrast between them so every scanner can read the code.',
    },
    {
      question: 'Is the QR code generated on a server?',
      answer:
        'No. QR codes are generated entirely in your browser with an offline library, so your URLs, text, and WiFi passwords never leave your device.',
    },
  ],
  'qr-decoder': [
    {
      question: 'How do I decode a QR code from an image?',
      answer:
        'Click to upload or drag and drop an image containing a QR code. The decoded content appears instantly and can be copied.',
    },
    {
      question: 'Can I decode QR codes from screenshots?',
      answer:
        'Yes. Screenshots, photos, and downloaded images all work, as long as the QR code is reasonably sharp and fully visible.',
    },
    {
      question: 'Why can a QR code fail to decode?',
      answer:
        'Blurry or very small images, low contrast, heavy compression, or a code that is cropped or partly covered can prevent decoding. Try a sharper or larger image.',
    },
    { question: 'Is my image uploaded to decode it?', answer: PRIVACY_ANSWER },
  ],

  // ── Color ─────────────────────────────────────────────────
  'color-picker': [
    {
      question: 'How do I convert HEX to RGB or HSL?',
      answer:
        'Enter a HEX code or pick a color, and the RGB and HSL values update instantly. Each format can be copied with one click.',
    },
    {
      question: 'What are complementary and triadic colors?',
      answer:
        'A complementary color sits opposite on the color wheel for maximum contrast. Triadic colors are spaced evenly around the wheel and make balanced three-color palettes.',
    },
    {
      question: 'How do I check color contrast for accessibility?',
      answer:
        'The tool shows the contrast ratio of your color against white and black and whether it meets WCAG AA and AAA requirements, so you can choose accessible text colors.',
    },
    { question: 'Does the color picker send data anywhere?', answer: PRIVACY_ANSWER },
  ],
  'gradient-generator': [
    {
      question: 'What types of CSS gradients can I create?',
      answer:
        'Linear gradients that flow in a direction, radial gradients that spread from a center point, and conic gradients that rotate around a center point.',
    },
    {
      question: 'How do I add or remove color stops?',
      answer:
        'Add as many color stops as you need, then set each stop’s color and position. A gradient needs at least two stops.',
    },
    {
      question: 'How do I use the generated gradient?',
      answer:
        'Copy the generated CSS and paste it into your stylesheet as a background value. The live preview always matches the generated code.',
    },
    { question: 'Is this gradient generator free?', answer: 'Yes. It is completely free, needs no sign-up, and runs entirely in your browser.' },
  ],

  // ── API / Network ─────────────────────────────────────────
  'curl-tester': [
    {
      question: 'What does the cURL tester do?',
      answer:
        'Paste a cURL command and it is parsed into its method, endpoint, headers, and request body, so you can check exactly what the command will send before running it.',
    },
    {
      question: 'Can I convert cURL to code?',
      answer:
        'Yes. The tool generates equivalent JavaScript (fetch) and Python (requests) code from your cURL command, ready to copy into your project.',
    },
    {
      question: 'Which cURL options are understood?',
      answer:
        'Common flags such as -X/--request, -H/--header, -d/--data, --data-raw, and multi-line commands with backslash continuations are parsed.',
    },
    {
      question: 'Is my cURL command, token, or API key sent anywhere?',
      answer:
        'No. Parsing and code generation run entirely in your browser, so headers, tokens, and payloads never leave your device.',
    },
  ],
  'curl-comparison': [
    {
      question: 'What does the cURL comparison tool compare?',
      answer:
        'It compares the HTTP method, URL and query parameters, headers, and request body of two cURL commands and highlights everything that differs.',
    },
    {
      question: 'How are header differences shown?',
      answer:
        'Headers are listed in a table with each header name and its value in both commands, so missing, extra, and changed headers are easy to spot.',
    },
    {
      question: 'Which cURL formats are supported?',
      answer:
        'Single-line and multi-line commands with backslash continuations, quoted values, and common header and data flags like -H, --header, -d, --data, and --data-raw.',
    },
    { question: 'Are my cURL commands sent anywhere?', answer: PRIVACY_ANSWER },
  ],
  deeplink: [
    {
      question: 'What is a deep link?',
      answer:
        'A deep link is a URL that opens a specific screen inside a mobile app, using a custom scheme like myapp://page or a verified web link (Android App Links or iOS Universal Links).',
    },
    {
      question: 'How do I test a deep link?',
      answer:
        'Enter the link and choose Launch in System App. On a device with the app installed, the app opens at the linked screen. Use Parse & Inspect to check the scheme, host, path, query, and fragment.',
    },
    {
      question: 'Why does my deep link not open the app?',
      answer:
        'The app may not be installed, the scheme may not be registered, or the browser may block custom schemes. Verified App Links and Universal Links also require correct domain association files.',
    },
    { question: 'Is my link sent to a server?', answer: PRIVACY_ANSWER },
  ],

  // ── Encoding ──────────────────────────────────────────────
  base64: [
    {
      question: 'What is Base64 encoding used for?',
      answer:
        'Base64 represents binary or text data using 64 safe ASCII characters. It is used in data URLs, email attachments, JSON payloads, and HTTP Basic authentication headers.',
    },
    {
      question: 'How do I encode or decode Base64?',
      answer:
        'Choose Encode to Base64 or Decode from Base64 and paste your input. The result updates instantly and supports Unicode text, including emoji and non-Latin scripts.',
    },
    {
      question: 'Is Base64 a form of encryption?',
      answer:
        'No. Base64 is an encoding, not encryption. Anyone can decode it, so never use it alone to protect passwords or secrets.',
    },
    { question: 'Is my data stored or uploaded?', answer: PRIVACY_ANSWER },
  ],
  'url-encoder': [
    {
      question: 'What is URL encoding?',
      answer:
        'URL encoding (percent-encoding) replaces characters that are unsafe in URLs, such as spaces and ampersands, with a % followed by their hex code. For example, a space becomes %20.',
    },
    {
      question: 'When should I URL-encode a value?',
      answer:
        'Encode query parameter values, path segments, and form data that contain spaces, symbols, or non-ASCII characters, so they are transmitted and parsed correctly.',
    },
    {
      question: 'How do I decode an encoded URL?',
      answer:
        'Choose Decode & Inspect and paste the encoded URL. Percent-encoded sequences are converted back to readable characters so you can inspect the parts of the URL.',
    },
    { question: 'Are my URLs sent anywhere?', answer: PRIVACY_ANSWER },
  ],

  // ── Regex ─────────────────────────────────────────────────
  'regex-tester': [
    {
      question: 'How do I test a regular expression?',
      answer:
        'Enter your pattern and flags, then type or paste a test string. Matches are highlighted live, and the match breakdown shows each match and its capture groups.',
    },
    {
      question: 'Which regex flavor does the tester use?',
      answer:
        'It uses the JavaScript regular expression engine built into your browser, with flags such as g (global), i (case-insensitive), m (multiline), and s (dot matches newlines).',
    },
    {
      question: 'What are capture groups?',
      answer:
        'Parentheses in a pattern capture the matched text so you can reuse it. For example, (\\d{3})-(\\d{4}) captures the two parts of a number separately.',
    },
    { question: 'Is my test data uploaded?', answer: PRIVACY_ANSWER },
  ],
  'regex-generator': [
    {
      question: 'What patterns can the regex generator create?',
      answer:
        'Ready-made patterns for email addresses, URLs, IPv4 addresses, hex colors, ISO dates, UUIDs, URL slugs, Indian and US phone numbers, plus custom patterns built from your own rules.',
    },
    {
      question: 'How do I check that a generated pattern works?',
      answer:
        'Type a sample value and the tool shows immediately whether it matches the pattern, so you can confirm it before copying the regex into your code.',
    },
    {
      question: 'Which languages can use the generated regex?',
      answer:
        'Patterns are written for JavaScript and work in most modern regex engines. Some syntax may need small adjustments for other languages, so test with your own data.',
    },
    { question: 'Is the regex generator free?', answer: 'Yes. It is free, needs no sign-up, and runs entirely in your browser.' },
  ],
  'regex-library': [
    {
      question: 'What is in the regex library?',
      answer:
        'A curated collection of commonly needed regular expressions, such as emails, URLs, and phone numbers, each with a description and a matching example.',
    },
    {
      question: 'How do I use a pattern from the library?',
      answer:
        'Copy the pattern into your code, or open it in the Regex Tester to try it against your own sample text first.',
    },
    {
      question: 'Can I customize these patterns?',
      answer:
        'Yes. The patterns are starting points. Edit them in the Regex Tester, or build a new one with the Regex Generator.',
    },
    {
      question: 'Are the patterns production ready?',
      answer:
        'They cover common cases and are widely used, but always test a pattern against your real data, because input formats vary between applications.',
    },
  ],

  // ── Security ──────────────────────────────────────────────
  'uuid-generator': [
    {
      question: 'What is the difference between UUID v1, v4, and v7?',
      answer:
        'v1 is based on a timestamp and node identifier, v4 is fully random, and v7 starts with a Unix timestamp so IDs sort by creation time. v7 is a great choice for database primary keys; v4 is the most common general-purpose UUID.',
    },
    {
      question: 'Are the generated UUIDs secure and unique?',
      answer:
        'Random bits come from your browser’s cryptographically secure random number generator, so collisions are practically impossible.',
    },
    {
      question: 'Can I generate UUIDs in bulk?',
      answer:
        'Yes. Set the quantity to generate many UUIDs at once, with options for uppercase output or removing hyphens, then copy or download them.',
    },
    { question: 'Are generated UUIDs stored anywhere?', answer: PRIVACY_ANSWER },
  ],

  // ── Social ────────────────────────────────────────────────
  'whatsapp-link': [
    {
      question: 'How do I create a WhatsApp click-to-chat link?',
      answer:
        'Enter the phone number with its country code and an optional pre-filled message. The tool builds a wa.me link that opens a chat with that number.',
    },
    {
      question: 'Do I need to save the number as a contact?',
      answer: 'No. A wa.me link opens a chat directly, without adding the number to your contacts.',
    },
    {
      question: 'Can I share the link as a QR code?',
      answer:
        'Yes. A QR code is generated for the link, so people can scan it with their phone camera to start the chat.',
    },
    { question: 'Is my phone number sent to a server?', answer: PRIVACY_ANSWER },
  ],
};

/** FAQs for a tool, or an empty list when none are defined */
export function getToolFaqs(toolId: string): ToolFaq[] {
  return TOOL_FAQS[toolId] ?? [];
}
