# Qlik Lambda Package
Node.js websocket services to stream realtime data into Qlik Sense and Unity

## Requirements
- *Used in conjunction with  [Qlik Manufacturing Analytics](https://github.com/ImmersiveAnalytics/ManufacturingAnalytics)*
- Must have Qlik Sense Desktop installed and running
- Must add Qlik apps (qvf files) into Qlik Sense app folder
- Must add Qlik extensions and mashup into Qlik Sense extension folder
  - Realtime Extension
  - RealtimeNew
  - VR_Mashup
  - Reload button
  - Alternate states extensions
- Must have Node.js installed

## To Run
- First type `node SensorClient.js` in a command prompt or terminal window
- Then type `node SmartNodeServer.js` in another command prompt or terminal window
- Then run Unity app

*Do not have Qlik apps open in Desktop or browser while trying to run Unity*

**Many thanks to [Chris Larsen](https://github.com/chrislarsenqlik) for creating the Lamba package**
