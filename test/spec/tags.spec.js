import { expect } from 'chai';
/* eslint import/no-unresolved: 0 */
/* eslint import/named: 0 */
import { extract } from '../../dist/tags';

describe('tags', () => {
  it('should extract tags from comments properly', () => {
    const result = extract(' adana: +foo -bar baz');
    expect(result).to.have.property('foo', true);
    expect(result).to.have.property('bar', false);
    expect(result).to.not.have.property('baz');
  });
});
