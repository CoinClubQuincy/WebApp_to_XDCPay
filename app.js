// App.js
import React, { useState } from "react";
import { XdcConnect, Disconnect } from "xdc-connect";
import "./App.css";
function App() {
 const [wallet, setwallet] = useState({});
console.log("wallet", wallet);
return (
   <div className="App">
     <XdcConnect
       btnClass={
         wallet.connected
           ? "btn btn-rounded btn-success"
           : "btn btn-rounded btn-warning"
       }
       btnName={wallet.connected ? "CONNECTED" : "CONNECT"}
       onConnect={(wallet) => {
         console.log("user connected wallet", wallet);
         setwallet(wallet);
       }}
       onDisconnect={(wallet) => {
         console.log("user connected disconnect", wallet);
         setwallet(wallet);
       }}
     />
     {wallet.connected ? <button onClick={Disconnect}>Logout</button> : ""}
   </div>
 );
}
export default App;