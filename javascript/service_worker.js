// Inspiration for this extension:
// http://zerodeveloper.tumblr.com/post/67664299242/chrome-extension-reload-tab-after-crash
// and
// https://github.com/unclespode/ohnoyoudidnt

// Different ways to test crashes and other problems in Chrome/Chromium:
// In Chrome/Chromium see chrome://about under "For debug", currently
// the following options are available:
// chrome://badcastcrash/
// chrome://crash/
// chrome://crashdump/
// chrome://kill/
// chrome://hang/
// chrome://shorthang
// chrome://gpuclean/
// chrome://gpucrash/
// chrome://gpuhang/
// chrome://memory-exhaust/
// chrome://ppapiflashcrash/
// chrome://ppapiflashhang/
// chrome://quit/
// chrome://restart/
//
// To crash the whole browser:
// chrome://inducebrowsercrashforrealz
//
// Another option is to open the developer tools on a tab that should be
// crashed and in the JavaScript console type:
//
// var memoryHog = "more"; while(true) {memoryHog = memoryHog + "andMore";}
//
// This code will consume so much memory that the tab will crash

// About reloading of tabs; see: https://developer.chrome.com/extensions/tabs
// chrome.tabs.reload(integer tabId, object reloadProperties, function callback)
//   tabId (integer optional): The ID of the tab to reload;
//         defaults to the selected tab of the current window.
//   reloadProperties (object optional): bypassCache (boolean optional): Whether
//         using any local cache. Default is false.
//   callback (function optional): If you specify the callback parameter,
//         it should be a function that looks like this: function() {...};
//
// For the use case of reloading a kiosk app or tabs that the user is using
// the default of calling chrome.tabs.reload() is best

// Initialise variables in local storage (needed since manifest version 3)
chrome.storage.local.set({ "tabSuccessCount": {} }) // store of successful probe calls
chrome.storage.local.set({ "tabUnresponsiveCount": {} }) // store of probe calls that got stuck in limbo
chrome.storage.local.set({ "tabsChecked": {} }) // store for arrays of tab-ids that were checked
chrome.storage.local.set({ "checkIndex": 0 }) // index of current array of checked tab-ids
chrome.storage.local.set({ "nrTabs": 0 }) // current number of tabs

function reloadTabIfNeeded(tab, checkIndex, tabsChecked, tabSuccessCount, tabUnresponsiveCount) {
  return function(result) {
    if (tab.title === "Crash-it") console.log("reloadTabIfNeeded - on Crash-it: chrome.runtime.lastError.message=" + (chrome.runtime.lastError !== undefined ? chrome.runtime.lastError.message : "-none-"));
    // console.log("reloadTabIfNeeded - executing anonymous function on " + (tab.title || "") + 
    //             ", result={docId:" + 
    //               (result !== undefined ? result[0].documentId.toString() + 
    //                 ", frameId:" + result[0].frameId.toString() + 
    //                 ", result:" + (result[0].result ? result[0].result.toString() : "-") : "-") + 
    //             "}");
    if (tabCrashed()) {
      console.log("Crashed tab: title=" + (tab.title || "") + " id=" + tab.id +
                  " index=" + tab.index.toString() + " windowId=" + tab.windowId.toString() +
                  " sessionId=" + (tab.sessionId || "").toString() +
                  " highlighted=" + tab.highlighted.toString() + " active=" + tab.active.toString());
      if (tabShouldBeReloaded(tab, tabSuccessCount)) {
        console.log("Reload tab:" + tab.id.toString());
        chrome.tabs.reload(tab.id);
      }
    } else {
      registerSuccessfulNoOp(tab, tabSuccessCount, tabUnresponsiveCount);
    }
    tabsChecked[checkIndex].push(tab.id);
  };
}

function tabShouldBeReloaded(tab, tabSuccessCount) {
  // Reload if at least one successful no-op has occurred.
  // This might be too cautious but ensures the tab was working
  // before it crashed
  // this also ensures that we do not reload a tab that takes a long
  // time to load (being unresponsive whilst doing so)
  return tabSuccessCount[tab.id] > 0;
}

function registerSuccessfulNoOp(tab, tabSuccessCount, tabUnresponsiveCount) {
  if ((tabSuccessCount[tab.id] || null) === null) {
    tabSuccessCount[tab.id] = 0;
  }
  tabSuccessCount[tab.id] += 1;
  tabUnresponsiveCount[tab.id] = 0;
}

function registerUnresponsive(tab, tabUnresponsiveCount) {
  if ((tabUnresponsiveCount[tab.id] || null) === null) {
    tabUnresponsiveCount[tab.id] = 0;
  }
  tabUnresponsiveCount[tab.id] += 1;
}

function tabCrashed() {
  // The crux of finding a crashed tab:
  // If an operation (even a no-op) is executed on a crashed tab an error
  // is reported which is available as the chrome.runtime.lastError
  // The error incorrectly reports the tab was closed instead of the fact that the
  // tab does not respond.
  if (chrome.runtime.lastError !== undefined) console.log("tabCrashed - chrome.runtime.lastError.message=" + chrome.runtime.lastError.message);
  return chrome.runtime.lastError && chrome.runtime.lastError.message === "The tab was closed.";
}

function checkTab(thisTab, checkIndex, tabsChecked, tabSuccessCount, tabUnresponsiveCount) {
  if (relevantTab(thisTab)) {
    // Perform a no-op as a probe to find if the tab responds
    // console.log("checkTab - executeScript on: " + (thisTab !== undefined ? thisTab.title : "-") + "("+ (thisTab !== undefined ? thisTab.id.toString() : "-") + ")");
    chrome.scripting.executeScript(
      {
        target: { tabId: thisTab.id }, 
        func: () => {
          // To find crashed tabs probing with a no-op is enough
          // null;
          // To find unresponsive tabs probing with some operation
          // that takes CPU-cycles is needed
          console.log("Snapper - executing injected anonymous function");
          1 + 1;
        }
      }, 
      reloadTabIfNeeded(thisTab, checkIndex, tabsChecked, tabSuccessCount, tabUnresponsiveCount)
    );
  }
}

function relevantTab(tab){
  // Only check tabs that have finished loading
  // and that use the http or https protocol.
  // This ignores tabs like chrome://...
  // return tab.url.substring(0, 4) == "http" && tab.status == "complete";
  // This makes testing this extension more difficult, to test use
  // the line below
  return tab !== undefined && tab !== null && tab.status !== undefined && tab.status !== null && tab.status === "complete";
}

function reloadUnresponsiveTabs(index, nrTabs, tabs, tabsChecked, tabSuccessCount, tabUnresponsiveCount) {
  if (nrTabs === tabs.length && nrTabs > tabsChecked[index].length) {
    var nrTabsToFind = nrTabs - tabsChecked[index].length;
    console.log("Found " + nrTabsToFind.toString() + " potentially unresponsive tabs");
    for (var j = 0; j < nrTabs && nrTabsToFind > 0; j += 1) {
      if (tabsChecked[index].indexOf(tabs[j].id) == -1) {
        registerUnresponsive(tabs[j], tabUnresponsiveCount);
        if (tabShouldBeReloaded(tabs[j], tabSuccessCount)) {
          console.log("Reload unresponsive tab:" + tabs[j].id.toString());
          // Reloading an unresponsive tab does not work
          // chrome.tabs.reload(tabs[j].id);
          // Therefore a new tab is created with the url of the old tab
          // and the unresponsive tab is removed.
          // Setting the new tab as active is mainly aimed at kiosk-like applications
          chrome.tabs.create({url: tabs[j].url, active: true}, function(tab){
            console.log("Created new tab: id=" + tab.id.toString() + " title=" + (tab.title || "") + " url=" + (tab.url || ""));
          });
          chrome.tabs.remove(tabs[j].id, function(){
            console.log("Removed unresponsive tab:" + tabs[j].id.toString());
          });
        }
        nrTabsToFind -= 1;
      }
    }
  }
}

async function checkTabs(tabs) {
  // check for unresponsive tabs by checking the results of
  // the previous round of checkTab calls
  // NOTE: it is assumed all tabs have been checked (all callbacks
  // initiated in the previous checkTabs call have ended (apart
  // form the ones that were done on unresponsive tabs)). The
  // interval between checks is 30 seconds (or more) which is 
  // long enough to make this a "certainty"
  let hash = await chrome.storage.local.get(["nrTabs", "checkIndex", "tabsChecked", "tabSuccessCount", "tabUnresponsiveCount"]); 
  let nrTabs = hash.nrTabs;
  let checkIndex = hash.checkIndex;
  let tabsChecked = hash.tabsChecked;
  let tabSuccessCount = hash.tabSuccessCount;
  let tabUnresponsiveCount = hash.tabUnresponsiveCount;
  
  console.log("Checking tabs - nrTabs: " + nrTabs.toString() + ", checkIndex: " + checkIndex.toString());
  if (nrTabs > 0) {
    reloadUnresponsiveTabs(checkIndex, nrTabs, tabs, tabsChecked, tabSuccessCount, tabUnresponsiveCount);
  }

  // roll the checkIndex around after 10 iterations
  checkIndex = checkIndex > 9 ? 0 : (checkIndex + 1);
  nrTabs = tabs.length;
  tabsChecked[checkIndex] = [];
  for (var i = 0; i < tabs.length; i += 1) {
    checkTab(tabs[i], checkIndex, tabsChecked, tabSuccessCount, tabUnresponsiveCount);
  }

  chrome.storage.local.set({ "nrTabs": nrTabs });
  chrome.storage.local.set({ "checkIndex": checkIndex });
  chrome.storage.local.set({ "tabsChecked": tabsChecked });
  chrome.storage.local.set({ "tabSuccessCount": tabSuccessCount });
  chrome.storage.local.set({ "tabUnresponsiveCount": tabUnresponsiveCount });
}

// Reset the count for tabs that are closed or that change
async function tabChanged(tabId, changeInfo, tab) {
  let hash = await chrome.storage.local.get(["tabSuccessCount", "tabUnresponsiveCount"]);
  let tabSuccessCount = hash.tabSuccessCount;
  let tabUnresponsiveCount = hash.tabUnresponsiveCount;

  console.log("tabChanged - Resetting stats for tab: id=" + tabId.toString() + ", title=" +
              (tab !== undefined ? tab.title : "-") + ", changeInfo=" + (changeInfo !== undefined ? changeInfo.status : "-"));
  tabSuccessCount[tabId] = 0;
  tabUnresponsiveCount[tabId] = 0;

  chrome.storage.local.set({ "tabSuccessCount": tabSuccessCount });
  chrome.storage.local.set({ "tabUnresponsiveCount": tabUnresponsiveCount });
}

async function startCheckTabAlarm() {
  // alarms cannot repeat in periods less than 30 seconds (0.5 minutes)
  await chrome.alarms.create("check-tab-alarm", { periodInMinutes: 0.5 });
}

startCheckTabAlarm();
// If the check-tab-alarm occurs (every 30 seconds) check the tabs
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "check-tab-alarm") {
    chrome.tabs.query({}, checkTabs);
  }
});
// If the tab reloads, reset stats
chrome.tabs.onUpdated.addListener(tabChanged);
chrome.tabs.onRemoved.addListener(tabChanged);
