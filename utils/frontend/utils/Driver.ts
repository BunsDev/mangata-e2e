import { WebDriver, Capabilities } from "selenium-webdriver";

require("chromedriver");
const { Builder } = require("selenium-webdriver");
let chrome = require("selenium-webdriver/chrome");
const path = 'utils/frontend/utils/extensions'
const polkadotExtensionPath = `${path}/polkadot_v0.38.3.crx`;
const metamaskExtensionPath = `${path}/metamask_9.8.2.0.crx`;

// Singleton constructor
export const DriverBuilder = (function () {
    
    async function buildChromeDriver(addExtensions = true) {
      
      let options = new chrome.Options();
      if(addExtensions){
        options.addExtensions(polkadotExtensionPath);
        options.addExtensions(metamaskExtensionPath);
      
      }
      let caps: Capabilities = new Capabilities();
      caps = Capabilities.chrome();
      caps.set("version", "91.0");
      caps.set("selenoid:options", {enableVNC: true, enableVideo: true })
      
      driver = new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .withCapabilities(caps)
          .build();
      
      await driver!.manage().window().maximize();
      
      return driver;
    }
    
    let driver: WebDriver| undefined;
    return {
      
      getInstance: async function (withExtensions = true) : Promise<WebDriver> {
        if (!driver) {
            driver = await buildChromeDriver(withExtensions);
        }
        return driver!;
      },
      destroy : async function (){
        driver = undefined;
      }
    }
})();



