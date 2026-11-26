# Passport photo models (self-hosted, so photos never leave the browser and no CDN is used)

- worker.js: our module worker that runs both models (see src/lib/image/passportBrowser.ts)
- ort.wasm.bundle.min.mjs, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm:
  onnxruntime-web 1.31.1 (MIT), from node_modules/onnxruntime-web/dist
- modnet-fp16.onnx: MODNet portrait matting (Apache-2.0, ZHKKKe/MODNet),
  ONNX export Xenova/modnet onnx/model_fp16.onnx. The 6.6 MB quantized export was tested and
  rejected: it leaves background behind and cuts away parts of the person.
- face-rfb320.onnx: Ultra-Light-Fast-Generic-Face-Detector-1MB version-RFB-320 (MIT, Linzaer)

When upgrading onnxruntime-web, copy the three ort files again and update the sizes in worker.js.
