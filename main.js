'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { default: axios } = require('axios');
const schedule = require('node-schedule');

let abfrageTimer = null;
let statelist = [];
let updateInterval = null;
// Load your modules here, e.g.:
// const fs = require("fs");

class OekofenPellematic extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'oekofen-pellematic',
		});
		this.apiClient = null;
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		// Initialize your adapter here


		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info('Pellematic-IP is ' + this.config['IP-Adress']);
		this.log.info('Pellematic-Port is ' + this.config['Port']);
		this.log.info('Pellematic-JSON is ' + this.config['JSON-Password']);
		/* ### */




		let pData = await this.getJSONfromOekofen();
		while (!pData) {
			setTimeout(() => {
				pData = this.getJSONfromOekofen();
			}, 2500);
		}


		const channels = Object.keys(pData);
		//this.log.warn(JSON.stringify(pData));
		const channelnames = Object.keys(pData);
		for (let y in channelnames) {

			this.setObjectNotExists(channelnames[y], {
				common: {
					name: channelnames[y]
				},
				type: 'channel',
				native: {}
			});
		}
		for (let i in pData) {

			const statenames = Object.keys(pData[i]);
			for (let x in statenames) {
				//Finde Role
				let staterole = 'text';
				let statetyp = 'string';
				let commonunit = '';


				if (typeof pData[i][statenames[x]]['unit'] !== 'undefined') {
					//	commonunit = pData[i][statenames[x]]['unit'];
					if (pData[i][statenames[x]]['unit'].indexOf('C') >= 0) {
						staterole = 'value.temperature';
						statetyp = 'number';
						commonunit = '°C';

					} else if (pData[i][statenames[x]]['unit'].indexOf('W') >= 0) {
						statetyp = 'number';
						staterole = 'value.power.consumption';
						commonunit = pData[i][statenames[x]]['unit'];


					} else if (pData[i][statenames[x]]['unit'].indexOf('%') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = '%';
					} else if (pData[i][statenames[x]]['unit'].indexOf('kg') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'kg';
					} else if (pData[i][statenames[x]]['unit'].indexOf('zs') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'Zs';
					} else if (pData[i][statenames[x]]['unit'].indexOf('EH') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'EH';
					} else if (pData[i][statenames[x]]['unit'].indexOf('min') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'Min';
					}
					else if (pData[i][statenames[x]]['unit'].indexOf('h') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'Stunden';
					}
					else if (pData[i][statenames[x]]['unit'].indexOf('K') >= 0) {
						statetyp = 'number';
						staterole = 'value';
						commonunit = 'K';
					}

				} else if (typeof pData[i][statenames[x]]['val'] !== 'undefined' && typeof pData[i][statenames[x]]['factor'] !== 'undefined') {
					statetyp = 'number';
					staterole = 'value';
					commonunit = '';
				}

				const statename = i + '.' + statenames[x];
				statelist.push(statename);
				this.log.warn(statename);

				if (statetyp == 'number') {
					this.setObjectNotExists(statename, {
						type: 'state',
						common: {
							read: true,
							write: false,
							role: staterole,
							name: statename,
							unit: commonunit,
							type: 'number'
						},

						native: {}
					});
				}
				if (statetyp == 'string') {
					this.setObjectNotExists(statename, {
						type: 'state',
						common: {
							read: true,
							write: false,
							role: staterole,
							name: statename,
							type: 'string'
						},

						native: {}
					});
				}


			}

		}


		abfrageTimer = setTimeout(() => { this.updateData(); }, 10000);

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		// await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		// await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		// await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync('admin', 'iobroker');
		this.log.info('check user admin pw iobroker: ' + result);

		result = await this.checkGroupAsync('admin', 'admin');
		this.log.info('check group user admin group admin: ' + result);
	}

	async getJSONfromOekofen() {
		this.apiClient = axios.create({
			baseURL: 'http://' + this.config['IP-Adress'] + ':' + this.config['Port'] + '/' + this.config['JSON-Password'],
			timeout: 4000,
			responseType: 'json',
			responseEncoding: 'utf8',
		});
		try {

			const peResponse = await this.apiClient.get('/all?');
			this.log.debug('connState:' + this.apiClient.getUri());
			//	this.log.debug('pedata:' + JSON.stringify(peResponse.data));



			if (peResponse.status === 200) {
				this.log.info('Send Data from Pellematic');
				await this.setStateAsync('info.connection', { val: true, ack: true });
				return peResponse.data;
			} else {
				await this.setStateAsync('info.connection', { val: false, ack: true });
			}

		} catch (e) {
			this.log.error(e);
			return false;
		}
	}

	async updateData() {

		const oekofenStates = [];

		this.getStates('oekofen-pellematic.0.*', function (err, states) {
			for (const id in states) {
				oekofenStates.push(id);

			}
		});


		try {
			const jsonData = await this.getJSONfromOekofen();


			//	console.log(JSON.stringify(jsonData));
			if (oekofenStates.length < 1) {
				this.log.warn('StateList empty: Please restart service');
			}

			for (let i = 0; i < statelist.length; i++) {

				const path = statelist[i].split('.');
				//	this.log.info(JSON.stringify(jsonData[path[0]][path[1]]));

				if(path[0] == 'forecast'){
					await this.setStateAsync(statelist[i], { val: jsonData[path[0]][path[1]]['val'] , ack: true });
				}

				if (typeof (jsonData[path[0]][path[1]]['val']) != 'undefined') {

					if (typeof (jsonData[path[0]][path[1]]['factor']) != 'undefined') {

						await this.setStateAsync(statelist[i], { val: jsonData[path[0]][path[1]]['val'] * jsonData[path[0]][path[1]]['factor'], ack: true });

					}
					if (typeof (jsonData[path[0]][path[1]]['format']) != 'undefined') {
						const format = JSON.stringify(jsonData[path[0]][path[1]]['format']).split('|');


						const formatarray = [];
						for (let ind = 0; ind < format.length; ind++) {

							const formatsplit = format[ind].replace('"', '').split(':');
							formatarray[formatsplit[0]] = formatsplit[1];
						}

						await this.setStateAsync(statelist[i], { val: formatarray[jsonData[path[0]][path[1]]['val']], ack: true });

					}
					if (path[1] == 'name') {
						await this.setStateAsync(statelist[i], { val: jsonData[path[0]][path[1]]['val'].replace('"', ''), ack: true });
					}



				} else {
					//	await this.setStateAsync(statelist[i], { val: JSON.stringify(jsonData[path[0]][path[1]]), ack: true });

					if (statelist[i].indexOf('name') >= 0 || statelist[i].indexOf('text') >= 0 || statelist[i].indexOf('info') >= 0) {
						await this.setStateAsync(statelist[i], { val: JSON.stringify(jsonData[path[0]][path[1]]).replace('"', ''), ack: true });
					} else {
						await this.setStateAsync(statelist[i], { val: JSON.stringify(jsonData[path[0]][path[1]]).replace('"', ''), ack: true });
					}

				}

			}



			abfrageTimer = this.setTimeout(() => this.updateData(), 25000);
		}
		catch (e) {
			this.log.warn('Update Data error: ' + e);
			abfrageTimer = this.setTimeout(() => this.updateData(), 15000);
		}
	}



	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...

			// clearInterval(interval1);
			this.clearTimeout(abfrageTimer);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new OekofenPellematic(options);
} else {
	// otherwise start the instance directly
	new OekofenPellematic();
}