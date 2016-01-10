/* eslint import/no-unresolved: 0 */
/* eslint import/named: 0 */
import dump from '../../dist/dump';

describe('dump', () => {
  it('should output the coverage data', () => {
    dump({ coverage: { }, path: '/tmp' });
  });
  it('should output pretty print if desired', () => {
    dump({ pretty: true, coverage: { }, path: '/tmp' });
  });
});
