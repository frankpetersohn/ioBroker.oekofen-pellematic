'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { default: axios } = require('axios');

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
		this.apiClient = axios.create({
			baseURL: 'http://' + this.config['IP-Adress'] + ':' + this.config['Port'] + '/' + this.config['JSON-Password'],
			timeout: 4000,
			responseType: 'json',
			responseEncoding: 'utf8',
		});
		try {
			
			let peResponse = await this.apiClient.get('/all?');

		

			this.log.debug('connState:' + this.apiClient.getUri());
			this.log.debug('pedata:' + JSON.stringify(peResponse.data));

			

			if (peResponse.status === 200) {
				const pData = peResponse.data;
				const channels = Object.keys(peResponse.data);

				const channelnames = Object.keys(peResponse.data);
				for (let y in channelnames) {

					this.setObjectNotExists(channelnames[y], {
						common: {
							name: channelnames[y]
						},
						type: 'channel',
						native: {}
					});
				}
				for (let i in peResponse.data) {
					const statenames = Object.keys(peResponse.data[i]);
					for (let x in statenames) {
						//Finde Role
						let staterole = 'text';
						let statetyp = 'string';
						let commonunit = '';


						if (typeof peResponse.data[i][statenames[x]]['unit'] !== 'undefined') {
							if (peResponse.data[i][statenames[x]]['unit'].indexOf('C') >= 0) {
								staterole = 'value.temperature';
								statetyp = 'number';
								commonunit = '°C';

							} else if (peResponse.data[i][statenames[x]]['unit'].indexOf('W') >= 0) {
								statetyp = 'number';
								staterole = 'value.power.consumption';
								commonunit = 'W';

								if (peResponse.data[i][statenames[x]]['unit'].indexOf('kwh') >= 0) {

									commonunit = 'KWh';
								}

							} else {
								let staterole = 'text';
								let statetyp = 'string';
								let commonunit = '';
							}




						}
						/*
						else if (statenames[x].indexOf('temp') >= 0) {
							//	if (statenames[x].indexOf('temp') >= 0) {
							staterole = 'value.temperature';
							statetyp = 'number';

						}*/

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

				/*
				peResponse.data.forEach(element => {
					Object.entries(element).forEach(([key]) =>{
						this.log.warn(key);
					});
				});*/


			}
		} catch (err) {
			this.log.error(this.apiClient.getUri());
			this.log.error(err);
		}

		abfrageTimer = setTimeout(() => { this.holeDaten(); }, 10000);
		//this.holeDaten();
		//updateInterval = setInterval(this.holeDaten, 30000);
		/* ### */





		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		
		await this.setObjectNotExistsAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('L_temp_act', {
			type: 'state',
			common: {
				role: 'value.temperature',
				name: 'Kesseltemperatur',
				type: 'number',
				read: true,
				write: false
			},
	
			native: {}
		});
		await this.setObjectNotExistsAsync('L_statetext', {
			type: 'state',
			common: {
				role: 'value.temperature',
				name: 'Pellematic Status',
				type: 'string',
				read: true,
				write: false
			},

			native: {}
		});
	*/

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



	async holeDaten() {

		//	abfrageTimer = null;
		this.log.info('Hole Daten');

		//if (arguments.length == 0) {
		this.apiClient = axios.create({
			baseURL: 'http://' + this.config['IP-Adress'] + ':' + this.config['Port'] + '/' + this.config['JSON-Password'],
			timeout: 1000,
			responseType: 'json',
			responseEncoding: 'utf8',
		});
		try {
			const peResponse = await this.apiClient.get('/all?');
			//this.log.debug('connState:' + this.apiClient.getUri());
			//this.log.debug('pedata:' + JSON.stringify(peResponse.data));
			if (peResponse.status === 200) {
				const pData = peResponse.data;
				this.log.debug(JSON.stringify(pData));
				//await this.setStateAsync('L_temp_act', { val: pData.pe1.L_temp_act.val * pData.pe1.L_temp_act.factor, ack: true });
				//await this.setStateAsync('L_statetext', { val: pData.pe1.L_statetext, ack: true });
				if(statelist.length < 1){
					this.log.warn('StateList empty: Please restart service');
				}
				for (let i = 0; i < statelist.length; i++) {
					//this.log.info(statelist[i]);

					let path = statelist[i].split('.');
					if (statelist[i].indexOf('circ1') >= 0) {
						this.log.error(JSON.stringify(pData[path[0]][path[1]]));
					}
					if (pData[path[0]][path[1]]['val'] != 'undefined') {
						if (pData[path[0]][path[1]]['factor'] != 'undefined') {
							await this.setStateAsync(statelist[i], { val: pData[path[0]][path[1]]['val'] * pData[path[0]][path[1]]['factor'], ack: true });

						} else {
							await this.setStateAsync(statelist[i], { val: pData[path[0]][path[1]]['val'], ack: true });
						}



					} else {


						if (statelist[i].indexOf('name') >= 0 || statelist[i].indexOf('text') >= 0) {
							await this.setStateAsync(statelist[i], { val: JSON.stringify(pData[path[0]][path[1]]), ack: true });
						} else {
							await this.setStateAsync(statelist[i], { val: JSON.stringify(pData[path[0]][path[1]]), ack: true });
						}

					}


					/*
					if (statelist[i].indexOf('temp') >= 0) {
		
		
						let stateval = pData[path[0]][path[1]]['val'];
						let statefact = pData[path[0]][path[1]]['factor'];
						this.log.warn(stateval);
						await this.setStateAsync(statelist[i], { val: pData[path[0]][path[1]]['val'] * pData[path[0]][path[1]]['factor'], ack: true });
					}*/
				}

			}
		} catch (err) {
			this.log.error(this.apiClient.getUri());
			this.log.error(err);
		}
		//}








		abfrageTimer = this.setTimeout(() => this.holeDaten(), 35000);
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
			//	this.clearTimeout(abfrageTimer);
			clearInterval(updateInterval);
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