
import { transformFile } from 'babel-core';
import { expect } from 'chai';
import path from 'path';

describe('Instrumenter', () => {

	const options = {
		plugins: [ './lib/plugin' ],
		stage: 0,
		sourceMaps: true
	};

	function transform(fixture, callback) {
		transformFile(
			path.join(__dirname, '..', 'fixtures', fixture + '.fixture.js'),
			options,
			callback
		);
	}



	it('should do something', done => {
		transform('statements', (err, result) => {
			expect(err).to.be.null;
			console.log(result.code);
			done();
		});
	});

	it.skip('should export coverage metadata', done => {
		transform('statements', (err, result) => {
			expect(err).to.be.null;
			expect(result.metadata).to.have.property('coverage');
			done();
		});
	});

	describe.skip('.stats', () => {

		var stats;

		beforeEach(done => {
			transform('complex', (err, result) => {
				expect(err).to.be.null;

				done();
			});
		});

		it('should correctly count number of functions', done => {

		});

		it('should correctly count number of statements', done => {

		});

		it('should correctly count number of branches', done => {

		});
	})

});
