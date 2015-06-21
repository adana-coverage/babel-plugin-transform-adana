
import Instrumenter from './instrumenter';

export default function create(babel) {
	var instr = new Instrumenter();
	return new babel.Transformer('adana-instrumenter', instr.visitor());
}
