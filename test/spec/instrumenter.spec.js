
import { expect } from 'chai';
import path from 'path';
import vm from 'vm';
import { transformFile, types, traverse } from 'babel-core';
import { parse } from 'babylon';

/* eslint import/no-unresolved: 0 */
/* eslint import/named: 0 */
import analyze from '../../dist/analyze';
import plugin, { key } from '../../dist/instrumenter';

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

  function run(fixture, { error: handlesError = false } = { }) {
    return transform(fixture).then(({ data, file }) => {
      const sandbox = vm.createContext({});
      let error = null;
      sandbox.global = { };
      sandbox.exports = { };
      // console.log(data.code);
      try {
        vm.runInContext(data.code, sandbox);
      } catch (err) {
        error = err;
      }
      if (!handlesError && error) {
        return Promise.reject(error);
      }
      return {
        ...(!sandbox.global.__coverage__ ?
          { } : analyze(sandbox.global.__coverage__[file])
        ),
        code: data.code,
        error,
      };
    });
  }

  describe('.key', () => {
    it('should fail with no location', () => {
      expect(() => key({ node: { } })).to.throw(TypeError);
    });
  });

  describe('statements', () => {
    it('should cover simple statements', () => {
      return run('statements').then(({ statement }) => {
        expect(statement).to.have.length(2);
        expect(statement[0]).to.have.property('count', 1);
        expect(statement[1]).to.have.property('count', 1);
      });
    });
  });

  describe('do-while loops', () => {
    it('should ignore previously instrumented loops', () => {
      const fixture = parse(`do { } while(true);`);
      const instrumenter = plugin({ types });
      const metadata = { };
      fixture.program.body[0].__adana = true;
      traverse(
        fixture,
        instrumenter.visitor,
        null,
        { file: { code: '', metadata, opts: { filenameRelative: '' } } }
      );
      expect(metadata.coverage).to.have.property('entries').to.have.length(0);
    });
    it('should cover do-while loops', () => {
      return run('do-while').then(({ branch, statement }) => {
        expect(statement).to.have.length(3);
        expect(statement[2]).to.have.property('count', 5);
        expect(branch).to.have.length(2);
        expect(branch[0]).to.have.property('count', 4);
        expect(branch[1]).to.have.property('count', 1);
      });
    });
  });

  describe('exceptions', () => {
    it('should ignore previously instrumented try', () => {
      const fixture = parse(`try { } catch(e) { };`);
      const instrumenter = plugin({ types });
      const metadata = { };
      fixture.program.body[0].__adana = true;
      traverse(
        fixture,
        instrumenter.visitor,
        null,
        { file: { code: '', metadata, opts: { filenameRelative: '' } } }
      );
      expect(metadata.coverage).to.have.property('entries').to.have.length(0);
    });
    it('should cover exceptions', () => {
      return run('try-catch').then(({ branch }) => {
        expect(branch).to.have.length(2);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 1);
      });
    });
    it('should cover exceptions', () => {
      return run('try-no-catch', { error: true })
        .then(({ branch, error }) => {
          expect(error).to.not.be.null;
          expect(branch).to.have.length(2);
          expect(branch[0]).to.have.property('count', 0);
          expect(branch[1]).to.have.property('count', 1);
        });
    });
  });

  describe('functions', () => {
    it('should cover functions', () => {
      return run('function').then(result => {
        expect(result.function).to.have.length(2);
        expect(result.function[0]).to.have.property('count', 2);
        expect(result.function[1]).to.have.property('count', 0);
      });
    });
    it('should cover arrow functions', () => {
      return run('arrow-function').then(result => {
        expect(result.function).to.have.length(1);
        expect(result.function[0]).to.have.property('count', 1);
      });
    });
  });

  describe('ternary expressions', () => {
    it('should cover ternary expressions', () => {
      return run('ternary').then(({ branch }) => {
        expect(branch).to.have.length(2);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 1);
      });
    });
  });

  describe('if blocks', () => {
    it('should cover if-else-if blocks', () => {
      return run('if-else-if').then(({ branch }) => {
        expect(branch).to.have.length(4);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 0);
        expect(branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover if-else blocks', () => {
      return run('if-else').then(({ branch }) => {
        expect(branch).to.have.length(2);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('logic expressions', () => {
    it('should cover logic', () => {
      return run('logic').then(({ branch }) => {
        expect(branch).to.have.length(6);
        expect(branch[0]).to.have.property('count', 1);
        expect(branch[1]).to.have.property('count', 0);
        expect(branch[2]).to.have.property('count', 1);
        expect(branch[3]).to.have.property('count', 0);
        expect(branch[4]).to.have.property('count', 0);
        expect(branch[5]).to.have.property('count', 0);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('switch blocks', () => {
    it('should ignore previously instrumented switch', () => {
      const fixture = parse(`switch(foo) { };`);
      const instrumenter = plugin({ types });
      const metadata = { };
      fixture.program.body[0].__adana = true;
      traverse(
        fixture,
        instrumenter.visitor,
        null,
        { file: { code: '', metadata, opts: { filenameRelative: '' } } }
      );
      expect(metadata.coverage).to.have.property('entries').to.have.length(0);
    });
    it('should cover switch statements', () => {
      return run('switch').then(({ branch }) => {
        expect(branch).to.have.length(3);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 0);
        expect(branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover switch statements without `default` rules', () => {
      return run('switch-no-default').then(({ branch }) => {
        expect(branch).to.have.length(3);
        expect(branch[0]).to.have.property('count', 0);
        expect(branch[1]).to.have.property('count', 0);
        expect(branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('while loops', () => {
    it('should cover while loops', () => {
      return run('while').then(({ branch }) => {
        expect(branch).to.have.length(2);
        expect(branch[0]).to.have.property('count', 4);
        expect(branch[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('classes', () => {
    it('should handle exported classes', () => {
      return run('class-export').then(({ statement }) => {
        expect(statement).to.have.length(2);
      });
    });
  });
});
