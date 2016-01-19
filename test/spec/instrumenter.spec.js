import { expect } from 'chai';
import path from 'path';
import vm from 'vm';
import { transformFile, types, traverse } from 'babel-core';
import { parse } from 'babylon';
import { tags } from 'adana-analyze';

/* eslint import/no-unresolved: 0 */
/* eslint import/named: 0 */
import plugin, { key } from '../../dist/instrumenter';

describe('Instrumenter', () => {
  const options = {
    plugins: [ [ '../', {
      ignore: 'test/spec/*.spec.js',
    } ] ],
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
      try {
        vm.runInContext(data.code, sandbox);
      } catch (err) {
        error = err;
      }
      if (!handlesError && error) {
        return Promise.reject(error);
      }
      return {
        tags: (!sandbox.global.__coverage__ ?
          { } : tags(sandbox.global.__coverage__[file].locations)
        ),
        coverage: sandbox.global.__coverage__[file],
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

  it('should ignore non-matching files via `ignore`', () => {
    const fixture = parse(`let i = 0; ++i;`);
    const instrumenter = plugin({ types });
    const metadata = { };
    traverse(
      fixture,
      instrumenter.visitor,
      null,
      {
        file: {
          code: '',
          metadata,
          opts: {
            filenameRelative: 'foo.css',
            filename: '/foo/foo.css',
          },
        },
        opts: {
          ignore: '**/*.css',
        },
      }
    );
    expect(metadata).to.not.have.property('coverage');
  });

  it('should ignore non-matching files via `only`', () => {
    const fixture = parse(`let i = 0; ++i;`);
    const instrumenter = plugin({ types });
    const metadata = { };
    traverse(
      fixture,
      instrumenter.visitor,
      null,
      {
        file: {
          code: '',
          metadata,
          opts: {
            filenameRelative: 'foo.css',
            filename: '/foo/foo.css',
          },
        },
        opts: {
          only: '**/*.js',
        },
      }
    );
    expect(metadata).to.not.have.property('coverage');
  });

  it('should accept matching files', () => {
    const fixture = parse(`let i = 0; ++i;`);
    const instrumenter = plugin({ types });
    const metadata = { };
    traverse(
      fixture,
      instrumenter.visitor,
      null,
      {
        file: {
          code: '',
          metadata,
          opts: {
            filenameRelative: 'foo.js',
            filename: '/foo/foo.js',
          },
        },
        opts: {
          test: '**/*.js',
        },
      }
    );
    expect(metadata).to.have.property('coverage');
  });

  describe('statements', () => {
    it('should cover simple statements', () => {
      return run('statements').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
        expect(tags.statement[0]).to.have.property('count', 1);
        expect(tags.statement[1]).to.have.property('count', 1);
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
      return run('do-while').then(({ tags }) => {
        expect(tags.statement).to.have.length(3);
        expect(tags.statement[2]).to.have.property('count', 5);
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 4);
        expect(tags.branch[1]).to.have.property('count', 1);
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
      return run('try-catch').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 1);
      });
    });
    it('should cover exceptions', () => {
      return run('try-no-catch', { error: true })
        .then(({ tags, error }) => {
          expect(error).to.not.be.null;
          expect(tags.branch).to.have.length(2);
          expect(tags.branch[0]).to.have.property('count', 0);
          expect(tags.branch[1]).to.have.property('count', 1);
        });
    });
  });

  describe('functions', () => {
    it('should ignore previously instrumented function', () => {
      const fixture = parse(`function foo() { };`);
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
    it('should cover functions', () => {
      return run('function').then(({ tags }) => {
        expect(tags.function).to.have.length(2);
        expect(tags.function[0]).to.have.property('count', 2);
        expect(tags.function[1]).to.have.property('count', 0);
      });
    });
    it('should cover arrow functions', () => {
      return run('arrow-function').then(({ tags }) => {
        expect(tags.function).to.have.length(1);
        expect(tags.function[0]).to.have.property('count', 1);
      });
    });
  });

  describe('ternary expressions', () => {
    it('should cover ternary expressions', () => {
      return run('ternary').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 1);
      });
    });
  });

  describe('if blocks', () => {
    it('should cover if-else-if blocks', () => {
      return run('if-else-if').then(({ tags }) => {
        expect(tags.branch).to.have.length(4);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 0);
        expect(tags.branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover if-else blocks', () => {
      return run('if-else').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('logic expressions', () => {
    it('should cover logic', () => {
      return run('logic').then(({ tags }) => {
        expect(tags.branch).to.have.length(6);
        expect(tags.branch[0]).to.have.property('count', 1);
        expect(tags.branch[1]).to.have.property('count', 0);
        expect(tags.branch[2]).to.have.property('count', 1);
        expect(tags.branch[3]).to.have.property('count', 0);
        expect(tags.branch[4]).to.have.property('count', 0);
        expect(tags.branch[5]).to.have.property('count', 0);
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
      return run('switch').then(({ tags }) => {
        expect(tags.branch).to.have.length(3);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 0);
        expect(tags.branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
    it('should cover switch statements without `default` rules', () => {
      return run('switch-no-default').then(({ tags }) => {
        expect(tags.branch).to.have.length(3);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 0);
        expect(tags.branch[2]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('while loops', () => {
    it('should cover while loops', () => {
      return run('while').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 4);
        expect(tags.branch[1]).to.have.property('count', 1);
        // TODO: Ensure all branches map to same group
      });
    });
  });

  describe('classes', () => {
    it('should handle exported classes', () => {
      return run('class-export').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
      });
    });
  });

  describe('tags', () => {
    it.skip('should handle line tags', () => {
      return run('tag-line').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
      });
    });
    it('should handle branch tags', () => {
      return run('tag-branch').then(({ tags }) => {
        expect(tags).to.have.property('foo').to.have.length(4);
        expect(tags.foo[0]).to.have.property('count', 0);
        expect(tags.foo[1]).to.have.property('count', 1);
        expect(tags.foo[2]).to.have.property('count', 1);
        expect(tags.foo[3]).to.have.property('count', 0);
        expect(tags).to.have.property('bar').to.have.length(4);
        expect(tags.bar[0]).to.have.property('count', 0);
        expect(tags.bar[1]).to.have.property('count', 0);
        expect(tags.bar[2]).to.have.property('count', 1);
        expect(tags.bar[3]).to.have.property('count', 1);
        expect(tags).to.have.property('baz').to.have.length(2);
        expect(tags.baz[0]).to.have.property('count', 1);
        expect(tags.baz[1]).to.have.property('count', 0);
        expect(tags).to.have.property('qux').to.have.length(1);
        expect(tags.qux[0]).to.have.property('count', 0);
      });
    });
    it.skip('should handle block tags', () => {
      return run('tag-block').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
      });
    });
  });
});
