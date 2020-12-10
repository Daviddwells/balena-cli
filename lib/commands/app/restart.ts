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
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { lowercaseIfSlug } from '../../utils/normalization';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	nameOrSlug: string;
}

export default class AppRestartCmd extends Command {
	public static description = stripIndent`
		Restart an application.

		Restart all devices belonging to an application.
`;
	public static examples = [
		'$ balena app restart MyApp',
		'$ balena app restart myorg/myapp',
	];

	public static args = [
		{
			name: 'nameOrSlug',
			description: 'application name or org/name slug',
			required: true,
			parse: lowercaseIfSlug,
		},
	];

	public static usage = 'app restart <nameOrSlug>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(AppRestartCmd);

		const { tryAsInteger } = await import('../../utils/validation');

		await getBalenaSdk().models.application.restart(
			tryAsInteger(params.nameOrSlug),
		);
	}
}
