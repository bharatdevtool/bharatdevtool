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
  // ── PDF ───────────────────────────────────────────────────
  'compress-pdf': [
    {
      question: 'How do I compress a PDF to 100 KB or 200 KB?',
      answer:
        'Choose "Exact size", pick 100 KB, 200 KB or type your own limit, and click Compress. The tool tries the sharpest quality that still fits and tells you if a file cannot get that small. This is the mode to use for exam and government form uploads.',
    },
    {
      question: 'What is the difference between "Keep text" and "Exact size"?',
      answer:
        '"Keep text" only recompresses the photos inside the PDF, so text stays sharp, selectable and searchable. "Exact size" turns each page into an image to reach a specific size, so text can no longer be selected. Try "Keep text" first.',
    },
    {
      question: 'Is there a file size or daily limit?',
      answer:
        'No. There is no daily limit and no upload, so large files are limited only by your device memory. Phones handle PDFs of several hundred pages; very large scans are faster on a computer.',
    },
    { question: 'Is my PDF uploaded to a server?', answer: PRIVACY_ANSWER },
  ],
  'merge-pdf': [
    {
      question: 'How do I merge PDF files?',
      answer:
        'Drop or choose all your PDFs, drag the page thumbnails into the order you want, and click Merge. You can add more files at any time, and remove or rotate single pages before saving.',
    },
    {
      question: 'Can I combine PDFs and images in one file?',
      answer:
        'Yes. JPG, PNG and WebP images become pages next to your PDF pages, so you can put a scanned photo between two PDF documents and save everything as one PDF.',
    },
    {
      question: 'Does merging reduce quality?',
      answer:
        'No. PDF pages are copied as they are, with text, links and images unchanged. To make the merged file smaller afterwards, click "Compress this result".',
    },
    { question: 'Are my files uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'split-pdf': [
    {
      question: 'How do I extract pages from a PDF?',
      answer:
        'Open the PDF, click the page thumbnails you want (Shift-click selects a range) and choose "Selected pages → one PDF". You can also type ranges such as 1-3, 5, 8-.',
    },
    {
      question: 'Can I split every page into its own PDF?',
      answer:
        'Yes. Choose "Every page → separate PDFs" and you get a ZIP with one PDF per page. "Custom ranges" makes one PDF per range, for example 1-3 and 4-6.',
    },
    {
      question: 'Does splitting change the pages?',
      answer: 'No. Pages are copied exactly, with text, images and links intact.',
    },
    { question: 'Is my PDF uploaded to a server?', answer: PRIVACY_ANSWER },
  ],
  'organize-pdf': [
    {
      question: 'How do I rotate pages in a PDF?',
      answer:
        'Open the PDF, select one or more pages and click Rotate (or press R). Rotate all pages at once with Select all, then save. The rotation is stored in the PDF, so it shows the same way everywhere.',
    },
    {
      question: 'How do I reorder or delete PDF pages?',
      answer:
        'Drag a page by its handle to a new place, or use the arrow buttons on touch screens. Select pages and press Delete or click the bin to remove them, then click Save.',
    },
    {
      question: 'Can I undo a change?',
      answer:
        'Nothing is changed in your original file. Until you save, you can re-add the file to start over; the new PDF is only created when you click Save.',
    },
    { question: 'Is my PDF uploaded to a server?', answer: PRIVACY_ANSWER },
  ],
  'pdf-to-jpg': [
    {
      question: 'How do I convert a PDF to JPG?',
      answer:
        'Open the PDF, choose JPG or PNG and a quality (150 DPI suits screens, 300 DPI suits printing), then click Convert. One page downloads as an image; several pages download as a ZIP.',
    },
    {
      question: 'Can I convert only some pages?',
      answer: 'Yes. Select the pages you want in the thumbnail grid first; only those are converted.',
    },
    {
      question: 'Should I choose JPG or PNG?',
      answer:
        'JPG makes much smaller files and is best for scans and photos. PNG is lossless and keeps text and line drawings perfectly sharp, at a larger size.',
    },
    { question: 'Is my PDF uploaded to a server?', answer: PRIVACY_ANSWER },
  ],
  'jpg-to-pdf': [
    {
      question: 'How do I convert JPG images to a PDF?',
      answer:
        'Drop or choose your images, drag them into order, rotate any that are sideways, pick a page size and click Create PDF. Each image becomes one page.',
    },
    {
      question: 'Which page size should I choose?',
      answer:
        'A4 is the standard for India and most forms; Letter is common in the US. "Fit to image" makes each page exactly the size of its image with no white border.',
    },
    {
      question: 'Which image formats are supported?',
      answer:
        'JPG, PNG and WebP, plus GIF, BMP and AVIF where your browser can open them. iPhone HEIC photos should be exported as JPG first.',
    },
    { question: 'Are my photos uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'protect-pdf': [
    {
      question: 'How do I password protect a PDF?',
      answer:
        'Open the PDF, type a password twice and click Protect PDF. The saved copy asks for that password every time it is opened, in any PDF reader on phone or computer.',
    },
    {
      question: 'How strong is the protection?',
      answer:
        'The file is encrypted with AES-256, the strongest standard PDF encryption. Without the password the content cannot be read. Use a long password that you do not use anywhere else.',
    },
    {
      question: 'What if I forget the password?',
      answer:
        'It cannot be recovered: we never see or store your password, and AES-256 cannot be bypassed. Keep the original unprotected file or write the password down somewhere safe.',
    },
    {
      question: 'Can I stop people from printing or copying?',
      answer:
        'Yes. Untick printing, copying, editing, comments, form filling or page changes. Most PDF readers respect these limits; some apps ignore them. Add an admin password if you want to lift the limits later.',
    },
    { question: 'Is my PDF or password uploaded?', answer: 'No. Encryption happens in your browser. Neither the file nor the password is ever sent anywhere.' },
  ],
  'unlock-pdf': [
    {
      question: 'How do I remove a password from a PDF?',
      answer:
        'Open the PDF, type its password when asked, and click Unlock PDF. The saved copy opens without a password. You need to know the password; this tool does not crack or guess passwords.',
    },
    {
      question: 'My PDF opens without a password but will not let me print or copy. Can this help?',
      answer:
        'Yes. Some PDFs, such as bank statements, only restrict printing or copying. Open the file and click Unlock PDF to save a copy without those restrictions.',
    },
    {
      question: 'Is the content changed?',
      answer: 'No. Pages, text, images and links are kept exactly; only the encryption is removed.',
    },
    { question: 'Is my PDF or password uploaded?', answer: 'No. Unlocking happens in your browser. Neither the file nor the password is ever sent anywhere.' },
  ],
  'edit-pdf': [
    {
      question: 'How do I add text to a PDF?',
      answer:
        'Open the PDF, choose Text and click where you want to type. Drag text to move it, and change its size, colour or boldness from the toolbar. Click Save edited PDF when you are done.',
    },
    {
      question: 'Can I change existing text in a PDF?',
      answer:
        'Use White-out to cover the old words, then Text to type the new words on top. Changing words in place is unreliable in every PDF tool because PDFs store letters at fixed positions.',
    },
    {
      question: 'Can I fill in PDF forms?',
      answer:
        'Yes. If the PDF has fillable fields, they are listed above the pages so you can type your answers. Tick “Lock the answers” to flatten the form so nobody can change them.',
    },
    {
      question: 'Does it work in Hindi and other languages?',
      answer:
        'Yes. Text in Hindi and other scripts, and symbols like ₹, is added exactly as you see it on screen.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'sign-pdf': [
    {
      question: 'How do I sign a PDF?',
      answer:
        'Open the PDF, click Signature and draw, type or upload your signature. Click the page to place it, drag to move it and use the corner handle to resize. Add the date with the Date tool, then save.',
    },
    {
      question: 'Can I upload a photo of my signature?',
      answer:
        'Yes. Sign on white paper, take a photo and upload it. “Remove the white paper background” makes it transparent so it looks natural on the page.',
    },
    {
      question: 'Is this a legally valid digital signature?',
      answer:
        'It adds an image of your signature, which is accepted for many everyday documents. It is not a certificate-based digital signature (DSC) or Aadhaar eSign, which some government and legal filings require.',
    },
    {
      question: 'Is my signature saved?',
      answer:
        'Only if you tick “Remember on this device”. It is then kept in this browser only and you can delete it any time.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'redact-pdf': [
    {
      question: 'How do I mask my Aadhaar number in a PDF?',
      answer:
        'Open the PDF, tick “Mask Aadhaar (first 8 digits only)” and click Find and mark. Only the last 4 digits stay visible, like UIDAI’s masked Aadhaar. Check the boxes and save.',
    },
    {
      question: 'Is the hidden text really gone?',
      answer:
        'Yes. Pages with black boxes are saved as images, so the text underneath cannot be copied, searched or recovered. Simply drawing a black box in other tools often leaves the text behind.',
    },
    {
      question: 'Why did it not find anything?',
      answer:
        'Scanned PDFs are pictures with no text layer, so automatic finding cannot read them. Draw boxes by hand with the Redact box tool instead.',
    },
    {
      question: 'Can I redact a name or address?',
      answer:
        'Yes. Type it in “Also find this text” to mark every occurrence, or draw boxes by hand.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'watermark-pdf': [
    {
      question: 'Why should I watermark my Aadhaar or PAN copy?',
      answer:
        'A copy stamped “For KYC purpose only” with the date and who it is for is much harder to misuse for anything else. It is a simple habit that protects ID copies you send to banks, landlords or employers.',
    },
    {
      question: 'Can someone remove the watermark?',
      answer:
        'A normal watermark can be removed with a PDF editor. Tick “Make it permanent” and pages become images with the watermark baked in, so it cannot be removed.',
    },
    {
      question: 'Can I use my company logo?',
      answer:
        'Yes. Add a PNG or JPG logo; it is placed in the middle of each page with the opacity you choose, alone or with text.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'add-page-numbers': [
    {
      question: 'How do I add page numbers to a PDF?',
      answer:
        'Open the PDF, choose the position, style and first number, check the preview and click Add page numbers.',
    },
    {
      question: 'Can I skip the cover page?',
      answer:
        'Yes. Tick “Don’t number the first page”; numbering then starts on page 2 with the number you choose.',
    },
    {
      question: 'Will it cover my content?',
      answer:
        'Numbers sit in the page margin. If your pages have content near the edge, choose a top position or a smaller size.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'grayscale-pdf': [
    {
      question: 'How do I make a PDF black and white?',
      answer:
        'Open the PDF, pick a quality and click Make black & white. Every page is converted to grayscale.',
    },
    {
      question: 'Will the text still be selectable?',
      answer:
        'No. Pages are converted to grayscale images, so text can no longer be selected or searched. Keep the original if you need that.',
    },
    {
      question: 'Which quality should I pick?',
      answer:
        'Standard suits screens and most uploads. High is better for printing. Smaller file is useful when a form limits the size.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'pdf-metadata': [
    {
      question: 'What is PDF metadata?',
      answer:
        'Hidden properties stored in the file: title, author, the software used, and dates. They show in the document properties of any PDF reader and can reveal more than you intend.',
    },
    {
      question: 'How do I remove it?',
      answer:
        'Open the PDF, tick “Remove all properties” and save. The document information and the hidden XMP block are removed.',
    },
    {
      question: 'Why change the title?',
      answer:
        'Browsers and many viewers show the PDF title in the tab. A clear title looks more professional than “Microsoft Word - final_v3.docx”.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'secure-share-pdf': [
    {
      question: 'How does the expiry work?',
      answer:
        'Your PDF is encrypted and hidden inside a new PDF whose only page explains how to open it. Our viewer checks the time against our server clock, not the phone’s, and refuses to open it after the expiry.',
    },
    {
      question: 'How does the recipient open it?',
      answer:
        'They tap the button on the PDF’s first page (or go to bharatdevtool.com/open) and choose the file. Nothing to install; it works on phones and computers. You decide whether they can print it.',
    },
    {
      question: 'Is this completely secure?',
      answer:
        'No tool without a server can be. It stops normal viewing after the expiry, but it cannot stop screenshots, cannot limit to a single view, and a determined expert could bypass it. Add a password for strong protection, and share it separately.',
    },
    {
      question: 'Is my file uploaded?',
      answer:
        'No. Encryption happens in your browser and you send the file yourself, so it never touches our servers.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'image-to-pdf': [
    {
      question: 'Which image formats work?',
      answer:
        'JPG, PNG, WebP, AVIF, GIF and BMP. Drop them together; each becomes one page. iPhone HEIC photos open in Safari; in other browsers, export them as JPG first.',
    },
    {
      question: 'Can I convert iPhone photos?',
      answer:
        'Yes. When you pick photos for upload, iPhones usually send them as JPG automatically. HEIC files also work directly in Safari. In other browsers, export them as JPG first (Settings → Camera → Formats → Most Compatible).',
    },
    {
      question: 'How do I put the images in order?',
      answer:
        'Drag the thumbnails by their handle, or use the arrows on phones, before clicking Create PDF.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
  ],
  'pdf-to-image': [
    {
      question: 'Which format should I choose?',
      answer:
        'JPG for photos and scans, PNG for sharp text and drawings, WebP for the smallest files on the web.',
    },
    {
      question: 'Can I convert only some pages?',
      answer:
        'Yes. Select pages in the thumbnail grid first; only those are converted.',
    },
    {
      question: 'What resolution do I need?',
      answer:
        '150 DPI suits screens and most uploads; 300 DPI suits printing.',
    },
    { question: 'Is my file uploaded anywhere?', answer: PRIVACY_ANSWER },
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
  'quickdrop': [
    {
      question: 'What is QuickDrop and how does it work?',
      answer:
        'QuickDrop is a free, in-browser peer-to-peer file transfer tool. It connects two devices directly using WebRTC DataChannels over your local Wi-Fi or the internet. Files stream directly from sender to receiver without passing through a server.',
    },
    {
      question: 'Are my files uploaded to or stored on any server?',
      answer:
        'No. Unlike cloud storage or email, your files are never uploaded to, processed by, or stored on any server. Data flows directly between the two browser sessions, end-to-end encrypted via WebRTC (DTLS/SCTP).',
    },
    {
      question: 'Is there any file size limit in QuickDrop?',
      answer:
        'No. Because files stream directly between devices in 64KB binary chunks without passing through server memory, there is no file size limit. You can transfer gigabyte-sized videos, zip archives, or high-res photos freely.',
    },
    {
      question: 'How do I fix "Failed to connect to peer" or WebRTC connection errors?',
      answer:
        'If two devices fail to connect automatically, it is usually due to symmetric NAT or client isolation on public Wi-Fi networks (like universities or cafes). To resolve this, click "Pair Device" to create a direct pairing room, or ensure both devices have WebRTC enabled in browser privacy settings.',
    },
    {
      question: 'Does QuickDrop work across different operating systems?',
      answer:
        'Yes. QuickDrop runs entirely in modern web browsers (Chrome, Safari, Firefox, Edge) and works seamlessly across Android, iOS, Windows, macOS, Linux, and ChromeOS with no app installation required.',
    },
  ],
};

/** FAQs for a tool, or an empty list when none are defined */
export function getToolFaqs(toolId: string): ToolFaq[] {
  return TOOL_FAQS[toolId] ?? [];
}
