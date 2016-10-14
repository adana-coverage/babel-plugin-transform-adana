/* global require */

import { expect } from 'chai';
import path from 'path';
import vm from 'vm';
import { transformFile, types, traverse } from 'babel-core';
import { parse } from 'babylon';
import { tags, lines } from 'adana-analyze';

/* eslint import/no-unresolved: 0 */
/* eslint import/named: 0 */
import plugin, { key } from '../../dist/instrumenter';

describe('Instrumenter', () => {
  const options = {
    plugins: [ 'syntax-jsx', [ require.resolve('../../'), {
      ignore: 'test/spec/*.spec.js',
    } ], [ 'transform-react-jsx', {
      pragma: 'createElement',
    } ] ],
    presets: [ ],
    sourceMaps: true,
    ast: false,
  };

  function line(_number, lines) {
    // FIXME: Workaround for issue in adana-analyze.
    const number = `${_number}`;
    for (let i = 0; i < lines.length; ++i) {
      if (lines[i].line === number) {
        return lines[i];
      }
    }
  }

  function grouped(...entries) {
    if (entries.length <= 0) {
      return;
    }
    const base = entries[0].group;
    entries.forEach(entry => expect(entry.group).to.equal(base));
  }

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
      const locations = !sandbox.global.__coverage__ ?
        [] : sandbox.global.__coverage__[file].locations;
      return {
        tags: tags(locations),
        lines: lines(locations),
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
    it('should cover object methods', () => {
      return run('function-property').then(({ lines, tags }) => {
        expect(tags.function).to.have.length(1);
        expect(line(3, lines)).to.have.property('count', 1);
      });
    });
    it('should cover class methods', () => {
      return run('class-property').then(({ lines, tags }) => {
        expect(tags.function).to.have.length(1);
        expect(line(3, lines)).to.have.property('count', 1);
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

    it('should cover adjunct ternary expressions', () => {
      return run('branch-double').then(({ tags }) => {
        expect(tags.branch).to.have.length(4);
        grouped(tags.branch[0], tags.branch[1]);
        grouped(tags.branch[2], tags.branch[3]);
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
        grouped(...tags.branch);
      });
    });
    it('should cover if-else blocks', () => {
      return run('if-else').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 1);
        grouped(...tags.branch);
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
        // TODO: Fix grouping for logic statements.
        // grouped(...tags.branch);
      });
    });
  });

  describe('objects', () => {
    it('should instrument computed object keys', () => {
      return run('object-computed-keys').then(({ lines }) => {
        expect(line(6, lines)).to.have.property('count', 1);
      });
    });

    it('should handle destructured objects', () => {
      return run('object-destructured').then(({ lines }) => {
        expect(line(6, lines)).to.have.property('count', 1);
      });
    });

    it('should handle objects with string keys', () => {
      return run('object-string-key').then(({ lines }) => {
        expect(line(6, lines)).to.have.property('count', 1);
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
        grouped(...tags.branch);
      });
    });
    it('should cover switch statements without `default` rules', () => {
      return run('switch-no-default').then(({ tags }) => {
        expect(tags.branch).to.have.length(3);
        expect(tags.branch[0]).to.have.property('count', 0);
        expect(tags.branch[1]).to.have.property('count', 0);
        expect(tags.branch[2]).to.have.property('count', 1);
        grouped(...tags.branch);
      });
    });
  });

  describe('while loops', () => {
    it('should cover while loops', () => {
      return run('while').then(({ tags }) => {
        expect(tags.branch).to.have.length(2);
        expect(tags.branch[0]).to.have.property('count', 4);
        expect(tags.branch[1]).to.have.property('count', 1);
        grouped(...tags.branch);
      });
    });
  });

  describe('return statements', () => {
    it('should handle normal return statements', () => {
      return run('return').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
        expect(tags.statement[0]).to.have.property('count', 1);
      });
    });
    it('should handle empty return statements', () => {
      return run('return-undefined').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
        expect(tags.statement[0]).to.have.property('count', 1);
      });
    });
    it('should handle multi-line return statements', () => {
      return run('return-multiline').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
        expect(tags.statement[0]).to.have.property('count', 1);
      });
    });
  });

  describe('jsx', () => {
    it('should handle simple JSX', () => {
      return run('jsx').then(({ lines }) => {
        expect(line(6, lines)).to.have.property('count', 1);
        expect(line(7, lines)).to.have.property('count', 1);
      });
    });
  });

  describe('hidden branches', () => {
    it('should handle partially constructed objects', () => {
      return run('half-execution-object').then(({ lines }) => {
        expect(line(13, lines)).to.have.property('count', 0);
      });
    });

    it('should handle partially constructed arrays', () => {
      return run('half-execution-array').then(({ lines }) => {
        expect(line(13, lines)).to.have.property('count', 0);
      });
    });

    it.skip('should handle partially constructed jsx', () => {
      return run('half-execution-array').then(({ lines }) => {
        expect(line(12, lines)).to.have.property('count', 0);
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

  describe('instrumentation disabling', () => {
    it('should skip instrumenting things', () => {
      return run('no-instrument').then(({ tags }) => {
        expect(tags).to.not.have.property('branch');
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
    it('should handle error tags', () => {
      return run('tag-error').then(({ tags }) => {
        expect(tags.foo[0]).to.have.property('count', 1);
        expect(tags.bar[0]).to.have.property('count', 1);
        expect(tags.baz[0]).to.have.property('count', 0);
      });
    });
    it.skip('should handle block tags', () => {
      return run('tag-block').then(({ tags }) => {
        expect(tags.statement).to.have.length(2);
      });
    });
  });
});
