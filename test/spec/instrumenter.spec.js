
import { expect } from 'chai';
import path from 'path';
import vm from 'vm';
import { transformFile } from 'babel-core';

/* eslint import/no-unresolved: 0 */
import analyze from '../../dist/analyze';

describe('Instrumenter', () => {
  const options = {
    plugins: [ '../' ],
    presets: [ ],
    sourceMaps: true,
    ast: false,
  };

  function transform(fixture) {
    const file = path.join('.', 'test', 'fixtures', `${fixture}.fixture.js`);
    return (new Promise((resolve, reject) => {
      transformFile(
        file,
        options,
        (err, data) => err ? reject(err) : resolve(data)
      );
    })).then(data => {
      return { file, data };
    });
  }

  function run(fixture) {
    return transform(fixture).then(({ data, file }) => {
      const sandbox = vm.createContext({});
      let error = null;
      sandbox.global = sandbox;
      try {
        vm.runInContext(data.code, sandbox);
      } catch (err) {
        error = err;
      }
      return {
        ...analyze(sandbox.__coverage__[file]),
        code: data.code,
        error,
      };
    });
  }

  describe('statements', () => {
    it('should cover simple statements', () => {
      return run('statements').then(({ statements }) => {
        expect(statements).to.have.length(3);
        expect(statements[0]).to.have.property('count', 1);
        expect(statements[1]).to.have.property('count', 1);
        expect(statements[2]).to.have.property('count', 1);
      });
    });
  });

  describe('do-while loops', () => {
    it('should cover do-while loops', () => {
      return run('do-while').then(({ branches, statements }) => {
        expect(statements).to.have.length(5);
        expect(statements[3]).to.have.property('count', 5);
        expect(branches).to.have.length(2);
        expect(branches[0]).to.have.property('count', 4);
        expect(branches[1]).to.have.property('count', 1);
      });
    });
  });

  describe('exceptions', () => {
    it('should cover exceptions', () => {
      return run('try-catch').then(({ branches }) => {
        expect(branches).to.have.length(2);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 1);
      });
    });
    it('should cover exceptions', () => {
      return run('try-no-catch').then(({ branches, error }) => {
        expect(error).to.not.be.null;
        expect(branches).to.have.length(2);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 1);
      });
    });
  });

  describe('functions', () => {
    it('should cover functions', () => {
      return run('function').then(({ branches, functions }) => {
        expect(branches).to.have.length(0);
        expect(functions).to.have.length(2);
        expect(functions[0]).to.have.property('count', 2);
        expect(functions[1]).to.have.property('count', 0);
      });
    });
  });

  describe('if blocks', () => {
    it('should cover if-else-if blocks', () => {
      return run('if-else-if').then(({ branches }) => {
        expect(branches).to.have.length(4);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 0);
        expect(branches[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover if-else blocks', () => {
      return run('if-else').then(({ branches }) => {
        expect(branches).to.have.length(2);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('switch blocks', () => {
    it('should cover switch statements', () => {
      return run('switch').then(({ branches }) => {
        expect(branches).to.have.length(3);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 0);
        expect(branches[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover switch statements without `default` rules', () => {
      return run('switch-no-default').then(({ branches }) => {
        expect(branches).to.have.length(3);
        expect(branches[0]).to.have.property('count', 0);
        expect(branches[1]).to.have.property('count', 0);
        expect(branches[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('while loops', () => {
    it('should cover while loops', () => {
      return run('while').then(({ branches }) => {
        expect(branches).to.have.length(2);
        expect(branches[0]).to.have.property('count', 4);
        expect(branches[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });
});
