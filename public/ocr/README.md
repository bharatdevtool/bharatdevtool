# OCR assets (self-hosted, so images never leave the browser and no CDN is used)

- worker.min.js: tesseract.js 7.0.0 (Apache-2.0), from node_modules/tesseract.js/dist
- core/*.wasm.js: tesseract.js-core 7.0.0 (Apache-2.0), LSTM builds only
- lang/eng.traineddata.gz: @tesseract.js-data/eng 1.0.0, 4.0.0_best_int (Tesseract English model, Apache-2.0)

When upgrading tesseract.js, copy the matching files again.
