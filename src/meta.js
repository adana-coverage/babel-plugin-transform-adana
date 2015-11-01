
export default function meta(state, value) {
  if (arguments.length > 1) {
    state.file.metadata.coverage = value;
  }
  return state.file.metadata.coverage;
}
