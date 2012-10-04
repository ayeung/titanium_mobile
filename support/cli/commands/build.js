/*
 * build.js: Titanium Mobile CLI build command
 *
 * Copyright (c) 2012, Appcelerator, Inc.  All Rights Reserved.
 * See the LICENSE file for more information.
 */

var appc = require('node-appc'),
	afs = appc.fs,
	ti = require('titanium-sdk'),
	path = require('path');

// TODO: need to support building modules... how do we know if --dir is a module or app? where is the module _build.js located?

exports.title = __('Build');
exports.desc = __('builds a project');
exports.extendedDesc = 'Builds an existing app or module project.';

exports.config = function (logger, config, cli) {
	return function (finished) {
		ti.platformOptions(logger, config, cli, 'build', function (platformConf) {
			finished({
				options: appc.util.mix({
					platform: {
						abbr: 'p',
						callback: function (platform) {
							return ti.resolvePlatform(platform);
						},
						desc: __('the target build platform'),
						hint: __('platform'),
						prompt: {
							label: __('Target platform [%s]', ti.availablePlatforms.join(',')),
							error: __('Invalid platform'),
							validator: function (platform) {
								platform = platform.trim();
								if (!platform) {
									throw new appc.exception(__('Invalid platform'));
								}
								if (ti.availablePlatforms.indexOf(platform) == -1) {
									throw new appc.exception(__('Invalid platform: %s', platform));
								}
								
								// it's possible that platform was not specified at the command line in which case the it would
								// be prompted for. that means that validate() was unable to apply default values for platform-
								// specific options and scan for platform-specific hooks, so we must do it here.
								
								var p = platformConf[platform];
								p && p.options && Object.keys(p.options).forEach(function (name) {
									if (p.options[name].default && cli.argv[name] === undefined) {
										cli.argv[name] = p.options[name].default;
									}
								});
								
								cli.scanHooks(afs.resolvePath(path.dirname(module.filename), '..', '..', platform, 'cli', 'hooks'));
								
								return true;
							}
						},
						required: true,
						values: ti.availablePlatforms
					},
					'project-dir': {
						abbr: 'd',
						desc: __('the directory containing the project, otherwise the current working directory')
					}
				}, ti.commonOptions(logger, config)),
				platforms: platformConf
			});
		});
	};
};

exports.validate = function (logger, config, cli) {
	ti.validatePlatform(logger, cli.argv, 'platform');
	if (ti.validatePlatformOptions(logger, config, cli, 'build') === false) {
		return false;
	}
};

exports.run = function (logger, config, cli) {
	var buildModule = path.join(path.dirname(module.filename), '..', '..', cli.argv.platform, 'cli', 'commands', '_build.js');
	
	if (!appc.fs.exists(buildModule)) {
		logger.error(__('Unable to find platform specific build command') + '\n');
		logger.log(__("Your SDK installation may be corrupt. You can reinstall it by running '%s'.", (cli.argv.$ + ' sdk update --force --default').cyan) + '\n');
		process.exit(1);
	}

	cli.fireHook('prebuild', function () {
		require(buildModule).run(logger, config, cli, function (err) {
			cli.fireHook('finalize', function () {
				var delta = appc.time.prettyDiff(cli.startTime, Date.now());
				if (err) {
					logger.error(__('Project failed to build after %s', delta) + '\n');
				} else {
					logger.info(__('Project built successfully in %s', delta) + '\n');
				}
			});
		});
	});
};
