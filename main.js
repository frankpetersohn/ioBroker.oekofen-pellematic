'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { default: axios } = require('axios');
const { stat } = require('fs/promises');
const { maxHeaderSize } = require('http');
//const schedule = require('node-schedule');
const { isNull } = require('util');

let abfrageTimer = null;
const statelist = [];
//let updateInterval = null;


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
		//this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		this.log.info('Pellematic-IP is ' + this.config['IP-Adress']);
		this.log.info('Pellematic-Port is ' + this.config['Port']);
		this.log.info('Pellematic-JSON is ' + this.config['JSON-Password']);

		await this.updateAdaperStructur();
		abfrageTimer = setTimeout(() => { this.updateData(); }, 20000);

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		this.subscribeStates('*');

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
	/**
	 * Erzeugt die Adapterstruktur
	 */
	async updateAdaperStructur() {


		let pData = await this.getJSONfromOekofen();
		console.log('pData ==> ' + pData);
		while (!pData) {
			setTimeout(() => {
				pData = this.getJSONfromOekofen();
			}, 3500);
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
				let statefactor = 0;
				let commonunit = '';
				let writable = false;

				const statename = this.name + '.' + this.instance + '.' + i + '.' + statenames[x];
				statelist.push(statename);
				const testObj = {};
				testObj._id = statename;
				testObj.type = 'state';
				testObj.common = {};
				testObj.common.custom = {};

				if (statenames[x].indexOf('L_') < 0) {

					writable = true;
				}

				if (typeof pData[i][statenames[x]]['unit'] !== 'undefined') {

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


				testObj.common = {
					type: statetyp,
					role: staterole,
					name: statename,
					unit: commonunit,
					read: true,
					write: writable,
					custom: {}
				};


				testObj.native = {};
				if (typeof pData[i][statenames[x]]['factor'] !== 'undefined') testObj.common.custom.factor = pData[i][statenames[x]]['factor'];
				if (typeof pData[i][statenames[x]]['min'] !== 'undefined') testObj.common.min = pData[i][statenames[x]]['min'];
				if (typeof pData[i][statenames[x]]['max'] !== 'undefined') testObj.common.max = pData[i][statenames[x]]['max'];
				if (typeof pData[i][statenames[x]]['format'] != 'undefined') {

					const format = JSON.stringify(pData[i][statenames[x]]['format']).split('|');
					testObj.common.states = {};
					for (let ind = 0; ind < format.length; ind++) {
						const formatsplit = format[ind].replace('"', '').split(':');
						console.log(formatsplit[0] + ' ==> ' + formatsplit[1]);
						testObj['common']['states'][formatsplit[0]] = formatsplit[1];
					}

				}
				this.setObjectNotExists(statename, testObj, (err, obj) => {
					if (err) {
						this.log.warn('Fehler beim Erstellen des Objekts: '+ err);
					} else {
						this.log.info('Objekt erfolgreich erstellt: '+obj);
					}
				});
				//await this.setObjectNotExists(statename, testObj);
				/*
								if (statetyp == 'number') {
									this.setObjectNotExists(statename, {
										type: 'state',
										common: {
											read: true,
											write: writable,
											role: staterole,
											name: statename,
											unit: commonunit,
											type: 'number',
				
										},
				
										native: {}
									});
								}
								if (statetyp == 'string') {
									this.setObjectNotExists(statename, {
										type: 'state',
										common: {
											read: true,
											write: writable,
											role: staterole,
											name: statename,
											type: 'string'
										},
				
										native: {}
									});
								}
				*/


			}

		}

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
				return false;

			}

		} catch (e) {
			this.log.error(e);
			return false;
		}
	}

	async updateData() {

		const adapterStates = [];
		const adatperPath = this.name + '.' + this.instance + '.*';

		this.getStates(adatperPath, function (err, states) {
			for (const id in states) {
				adapterStates.push(id);
				//console.log('Adapter: ' + id);
			}
		});


		try {
			const jsonData = await this.getJSONfromOekofen();
			if (jsonData != false) {
				const jsonChannels = Object.keys(jsonData);
				const jsonStates = [];
				for (let i in jsonChannels) {
					//console.log('JSON Channels ' + jsonChannels[i]);
					const StatesInChannel = Object.keys(jsonData[jsonChannels[i]]);
					for (let x in StatesInChannel) {
						jsonStates.push(jsonChannels[i] + '.' + StatesInChannel[x]);
						//console.log('JSON: ' + jsonChannels[i] + '.' + StatesInChannel[x]);
					}

				}


				if (adapterStates.length < 1) {
					this.log.warn('StateList empty: Please restart service');
				}


				for (let i = 0; i < jsonStates.length; i++) {
					const path = jsonStates[i].split('.');

					let currentStateValue;

					const statepath = this.name + '.' + this.instance + '.' + jsonStates[i];
					this.getState(statepath, function (err, state) {
						if (state != null)
							currentStateValue = state.val;

					});
					let stateType;
					this.getObject(this.name+'.'+this.instance+'.'+jsonStates[i], (err, stateObj) => {
						if (err) {
							this.log.error('Fehler beim Abrufen des State-Objekts: '+ err);
						} else {
							if (stateObj && stateObj.common && stateObj.common.type) {
								stateType = stateObj.common.type;
							} else {
								console.log('Das State-Objekt oder der Typ wurden nicht gefunden.');
							}
						}
					});
					let wert = jsonData[path[0]][path[1]]['val'];
					if (typeof (jsonData[path[0]][path[1]]['val']) != 'undefined') {
						if (path[0] == 'forecast') {
							if(stateType=='number')wert=parseFloat(wert);
							await this.setStateAsync(jsonStates[i], { val: wert, ack: true });
						}

						if (typeof (jsonData[path[0]][path[1]]['factor']) != 'undefined') {
							const wert = parseFloat(jsonData[path[0]][path[1]]['val']);
							const faktor = parseFloat(jsonData[path[0]][path[1]]['factor']);
					
							await this.setStateAsync(jsonStates[i], {val: wert*faktor, ack: true });
						}

						if (typeof (jsonData[path[0]][path[1]]['format']) != 'undefined') {
							const format = JSON.stringify(jsonData[path[0]][path[1]]['format']).split('|');
							const formatarray = [];
							for (let ind = 0; ind < format.length; ind++) {

								const formatsplit = format[ind].replace('"', '').split(':');
								formatarray[formatsplit[0]] = formatsplit[1];
							}
							await this.setStateAsync(jsonStates[i], { val: formatarray[jsonData[path[0]][path[1]]['val']], ack: true });

						}
						if (path[1] == 'name') {
							await this.setStateAsync(jsonStates[i], { val: jsonData[path[0]][path[1]]['val'].replace('"', ''), ack: true });
						}



					} else {

						if (statelist[i].indexOf('name') >= 0 || jsonStates[i].indexOf('text') >= 0 || jsonStates[i].indexOf('info') >= 0) {
							await this.setStateAsync(jsonStates[i], { val: JSON.stringify(jsonData[path[0]][path[1]]).replace('"', ''), ack: true });
						} else {
							await this.setStateAsync(jsonStates[i], { val: JSON.stringify(jsonData[path[0]][path[1]]).replace('"', ''), ack: true });
						}

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
			//this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			this.sendState(id, state);


		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	async sendState(id, state) {

		this.getObject(id, (err, obj) => {
			if(typeof obj === 'object'){
				if (typeof obj.common.custom != 'undefined') {
					if (typeof obj.common.custom.factor != 'undefined') {
						state.val = state.val / obj.common.custom.factor;
					}
				}
			}
		});


		if (!state.ack) {
			this.apiClient = axios.create({
				baseURL: 'http://' + this.config['IP-Adress'] + ':' + this.config['Port'] + '/' + this.config['JSON-Password'],
				timeout: 4000,
				responseType: 'json',
				responseEncoding: 'utf8',
			});
			try {

				const path = id.split('.');
				const resturi = '/' + path[2] + '.' + path[3] + '=' + state.val;
				this.log.debug(resturi);
				const peResponse = await this.apiClient.get(resturi);
				this.log.debug('connState:' + this.apiClient.getUri());

				if (peResponse.status === 200) {
					this.log.info('Send Data from Pellematic');
					this.setStateAsync('info.connection', { val: true, ack: true });
					return peResponse.data;
				} else {
					this.setStateAsync('info.connection', { val: false, ack: true });
				}

			} catch (e) {
				this.log.error(e);
				return false;
			}
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