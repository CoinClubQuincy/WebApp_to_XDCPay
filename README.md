Website integration of XDCPay tutorial

  

## **Step 1:**

**Dependencies:**

Install Dependencies needed to connect to the XDC APIs to allow for the connection to XDC Pay.

  

**Mac:**

    brew install node@14
    
    npm node-gyp
    
    npm i xdc-connect

**Ubuntu:**

    sudo apt install nodejs
    npm i xdc-connect

**Windows:** https://nodejs.org/en/download/

    npm i xdc-connect

## Step 2:

**WebApp:**

Integrate XDC Pay connect script into app.js script on Web application as well to allow for a connection to be made between the webApp and XDC Pay. Once the base connect script has been created additional functions can be included in the script to interact with the smart contract that manages the functionality of the site.

  
````javascript
    // App.js
    
    import  React, { useState } from  "react";
    
    import { XdcConnect, Disconnect } from  "xdc-connect";
    
    import  "./App.css";
    
    function  App() {
    
    const [wallet, setwallet] = useState({});
    
    console.log("wallet", wallet);
    
    return (
    
    <div  className="App">
    
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
    
    {wallet.connected ? <button  onClick={Disconnect}>Logout</button> : ""}
    
    </div>
    
    );
    
    }
    
    export  default  App;
````    
      

[Add web app display]

  

## Step 3:

**Solidity smart contract:**

In this example i created a basic login token where if the user hold the token they are able to login to website, but in reality and contract can be integrated into the website even contracts that were not originally created by the develop of the site

      
````solidity    
    // SPDX-License-Identifier: MIT
    
    pragma  solidity  ^0.8.0;
    
    import  "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
    
    contract LoginTokenExample is ERC1155 {
    
    uint256  public  constant LoginToken =  0;
    
    constructor()  public ERC1155("Login Token Example")  {
    
    _mint(msg.sender, LoginToken,  1,  "");
    
    }
    
    modifier OnlyLogin{
    
    require(balanceOf(msg.sender,LoginToken)  >=  1,  "require Login token to login");
    
    _;
    
    }
    
    function checkLogin()public OnlyLogin returns(bool){
    
    return  true;
    
    }
    
    }
````
  

## Step 4:

**Launch Contract (Remix):**

When Launching a contract in remix there a a few things needed to connect XDC pay and launch the contract.

1.  Write contract and Have the XDCPay Browser extension installed
    
2.  Select Environment Injected Provider ts should say Custom(50) network after selected
    
3.  Deploy contract and sign transaction in XDCPay
    
4.  Check XDC BlocksScan for contract confirmation ([https://xdc.blocksscan.io/](https://xdc.blocksscan.io/))
    

![](https://lh5.googleusercontent.com/YRS11f9N9FZH6zgGYtU9asBEnYgucoLkgut8_fRJ2Eit3nh2q7XBRRN3jklhZ-jPX47vpgNrZ7GTKcGUT6eWgP59o0G4qj5OBIHe3WnTOrnhZ1NU4ZckHgwxyg-DCzoSMMVtdX4MHxHDApwsN0G2cxs)

## Connect XDCPay:

![](https://lh6.googleusercontent.com/gUbfGVDh3_zg_GdPHL97e2UJVgvALG4Q1wFyzWzUr-pWBPGrw_ivp8eP88yQA6s1ctldOPDtXZM8zf-7YAZt56AsoD265Ux0sZT934vCyll3Z2p8RMIJ5nngBO1eHrwM_v43Dy6JyjcQHH0paWeldCA)

  
  
  

## Deploy Contract:

![](https://lh6.googleusercontent.com/6e1ROKqw3N4c-5YQR2rlmqQl5YsG9NGxqIMWWvA65mRuK-7MfS3aJIaLvnBayqqOa1khw9u87npr2blIM_bCczrZlPkx3KBmXDUfezU28zcUPUw7xnRJO83XHPL9VVEpJmXHx698r464xcUyVN3ugr8)

## Check Contract on Blockscan:
[https://xdc.blocksscan.io/](https://xdc.blocksscan.io/)

![](https://lh5.googleusercontent.com/lkhRmNbGVj9aODOztmm9bzYJY-nnqvvOQmFC1yZXLiyDvodmtXbLy7Z4bPS1aS-IEdZrklaf6toGtaznC7iBUdw5TFROCAZaaKzOve3lINmN4EX28ApY91PiWqg75oTOl2ii0mbYM0YB2Q-lrE2TQ-A)

  
## Step 5:

**Test Application**
Check functions in web application to see if functions execute through XDCPay if having any trouble check the Javascript functions in your app.js and make sure they aline with the smart contract functions you're trying to call.
