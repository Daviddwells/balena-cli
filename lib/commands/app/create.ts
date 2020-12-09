/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { flags } from '@oclif/command';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import type { Application } from 'balena-sdk';

interface FlagsDef {
	organization?: string;
	type?: string; // application device type
	help: void;
}

interface ArgsDef {
	name: string;
}

export default class AppCreateCmd extends Command {
	public static description = stripIndent`
		Create an application.

		Create a new balena application.

		You can specify the organization the application should belong to using
		the \`--organization\` option, and the application device type with the
		\`--type\` option.

		If no device type or organization is specified, interactive dropdowns
		will be shown for you to select from.

		You can see a list of supported device types with:

		$ balena devices supported
	`;

	public static examples = [
		'$ balena app create MyApp',
		'$ balena app create MyApp --organization MyOrg',
		'$ balena app create MyApp -o MyOrg --type raspberry-pi',
	];

	public static args = [
		{
			name: 'name',
			description: 'application name',
			required: true,
		},
	];

	public static usage = 'app create <name>';

	public static flags: flags.Input<FlagsDef> = {
		organization: flags.string({
			char: 'o',
			description: 'the organization the application should belong to',
		}),
		type: flags.string({
			char: 't',
			description:
				'application device type (Check available types with `balena devices supported`)',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			AppCreateCmd,
		);

		// Ascertain device type
		const deviceType =
			options.type ||
			(await (await import('../../utils/patterns')).selectDeviceType());

		// Ascertain organization
		const organization = options.organization || (await this.getOrganization());

		// Create application
		let application: Application;
		try {
			application = await getBalenaSdk().models.application.create({
				name: params.name,
				deviceType,
				organization,
			});
		} catch (err) {
			// BalenaRequestError: Request error: Unique key constraint violated
			if ((err.message || '').toLowerCase().includes('unique')) {
				const slug = `${organization.toLowerCase()}/${params.name.toLowerCase()}`;
				throw new ExpectedError(`Error: application "${slug}" already exists`);
			}
			throw err;
		}

		// Output result
		console.log(
			`Application created: ${application.slug} (${deviceType}, id ${application.id})`,
		);
	}

	async getOrganization() {
		const { getOwnOrganizations } = await import('../../utils/sdk');
		const organizations = await getOwnOrganizations(getBalenaSdk());

		if (organizations.length === 0) {
			// User is not a member of any organizations (should not happen).
			throw new Error('This account is not a member of any organizations');
		} else if (organizations.length === 1) {
			// User is a member of only one organization - use this.
			return organizations[0].handle;
		} else {
			// User is a member of multiple organizations -
			const { selectOrganization } = await import('../../utils/patterns');
			return selectOrganization(organizations);
		}
	}
}
