fs = require('fs')
_ = require('lodash')
Promise = require('bluebird')
umount = Promise.promisifyAll(require('umount'))
unzip = require('unzip2')
resin = require('resin-sdk')
manager = require('resin-image-manager')
visuals = require('resin-cli-visuals')
form = require('resin-cli-form')
init = require('resin-device-init')
helpers = require('../utils/helpers')
patterns = require('../utils/patterns')

exports.download =
	signature: 'os download <type>'
	description: 'download an unconfigured os image'
	help: '''
		Use this command to download an unconfigured os image for a certain device type.

		Examples:

			$ resin os download parallella -o ../foo/bar/parallella.img
	'''
	permission: 'user'
	options: [
		signature: 'output'
		description: 'output path'
		parameter: 'output'
		alias: 'o'
		required: 'You have to specify an output location'
	]
	action: (params, options, done) ->
		console.info("Getting device operating system for #{params.type}")

		manager.get(params.type).then (stream) ->
			bar = new visuals.Progress('Downloading Device OS')
			spinner = new visuals.Spinner('Downloading Device OS (size unknown)')

			stream.on 'progress', (state) ->
				if state?
					bar.update(state)
				else
					spinner.start()

			stream.on 'end', ->
				spinner.stop()

			# We completely rely on the `mime` custom property
			# to make this decision.
			# The actual stream should be checked instead.
			if stream.mime is 'application/zip'
				output = unzip.Extract(path: options.output)
			else
				output = fs.createWriteStream(options.output)

			return helpers.waitStream(stream.pipe(output)).return(options.output)
		.tap (output) ->
			console.info("The image was downloaded to #{output}")
		.nodeify(done)

stepHandler = (step) ->
	step.on('stdout', _.bind(process.stdout.write, process.stdout))
	step.on('stderr', _.bind(process.stderr.write, process.stderr))

	step.on 'state', (state) ->
		return if state.operation.command is 'burn'
		console.log(helpers.stateToString(state))

	bar = new visuals.Progress('Writing Device OS')

	step.on('burn', _.bind(bar.update, bar))

	return helpers.waitStream(step)

exports.configure =
	signature: 'os configure <image> <uuid>'
	description: 'configure an os image'
	help: '''
		Use this command to configure a previously download operating system image with a device.

		Examples:

			$ resin os configure ../path/rpi.img 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	'''
	permission: 'user'
	action: (params, options, done) ->
		console.info('Configuring operating system image')
		resin.models.device.get(params.uuid)
			.get('device_type')
			.then(resin.models.device.getManifestBySlug)
			.get('options')
			.then(form.run)
			.then (answers) ->
				init.configure(params.image, params.uuid, answers).then(stepHandler)
		.nodeify(done)

exports.initialize =
	signature: 'os initialize <image> <type>'
	description: 'initialize an os image'
	help: '''
		Use this command to initialize a previously configured operating system image.

		Examples:

			$ resin os initialize ../path/rpi.img 'raspberry-pi'
	'''
	permission: 'user'
	action: (params, options, done) ->
		console.info('Initializing device')
		resin.models.device.getManifestBySlug(params.type)
			.then (manifest) ->
				return manifest.initialization?.options
			.then(form.run)
			.tap (answers) ->
				return if not answers.drive?
				message = "This will erase #{answers.drive}. Are you sure?"
				patterns.confirm(options.yes, message)
					.return(answers.drive)
					.then(umount.umountAsync)
			.tap (answers) ->
				return init.initialize(params.image, params.type, answers).then(stepHandler)
			.then (answers) ->
				return if not answers.drive?
				umount.umountAsync(answers.drive).tap ->
					console.info("You can safely remove #{answers.drive} now")
		.nodeify(done)