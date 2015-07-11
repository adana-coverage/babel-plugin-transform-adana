
import { expect } from 'chai';
import path from 'path';
import vm from 'vm';
import fs from 'fs';
import { transformFile } from 'babel-core';

describe('Instrumenter', () => {

	const options = {
		plugins: [ '../test/dist/lib/instrumenter' ],
		stage: 0,
		sourceMaps: true,
		ast: false
	};

	function transform(fixture, callback) {
		transformFile(
			path.join('.', 'test', 'fixtures', fixture + '.fixture.js'),
			options,
			callback
		);
	}

	function run(fixture, callback) {
		transform(fixture, function(err, data) {
			console.log('TRANFAARRMED', arguments)
			if (err) {
				callback(err)
			} else {
				const sandbox = vm.createContext({});
				sandbox.global = sandbox;
				vm.runInContext(data.code, sandbox);
				callback(null, {
					coverage: sandbox.__coverage__
				});
			}
		})
	}


	it('should do something', done => {
		console.log('MAH N IGGGERRERS')
		run('statements', (err, result) => {
			if (err) {
				done(err);
			} else {
				console.log(result);
				done();
			}
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
