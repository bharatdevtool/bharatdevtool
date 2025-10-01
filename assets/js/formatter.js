// formatter.js

export function formatJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (err) {
    throw new Error("Invalid JSON: " + err.message);
  }
}

export function minifyJSON(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch (err) {
    throw new Error("Invalid JSON: " + err.message);
  }
}
