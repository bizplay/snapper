var tab_id;
var tabProcesses = {};

chrome.browserAction.onClicked.addListener(function (tab) {
    tab_id = tab.id;
    console.log("onClicked.addListener: tab_id=" + tab_id);
    chrome.processes.getProcessIdForTab(tab.id, function (processId) {
      console.log("getProcessIdForTab: tab.id=" + tab.id);
      if (!isNaN(parseFloat(processId)) && isFinite(processId)) {
        // chrome.processes.terminate(processId, function(didTerminate) {
        //   console.log("onClicked.addListener.getProcessIdForTab chrome.processes.terminate(: didTerminate" + toString(didTerminate));
        //   // chrome.processes.terminate
        // });
      }
    });
});

function getTabAndProcessIds(tabs) {
  var tabsLength = 0;
  var tabId = 0;

  if (tabs !== null && tabs !== undefined && tabs.length > 0) {
    tabsLength = tabs.length;
    console.log("getTabsInfo: #Tabs=" + tabsLength);
    for (var i = 0; i < tabsLength; i += 1) {
      aTab = tabs[i];
      chrome.processes.getProcessIdForTab(aTab.id, function(processId) {
        if (tabProcesses[aTab.id.toString()] === undefined || (tabProcesses[aTab.id.toString()] !== undefined && tabProcesses[aTab.id.toString()] !== processId)) {
          tabProcesses[aTab.id.toString()] = processId;
        }
      });
    }
  }
}

function getTabsInfo(tabs) {
  var tabsLength = 0;
  var tabId = 0;

  if (tabs !== null && tabs !== undefined && tabs.length > 0) {
    tabsLength = tabs.length;
    for (var i = 0; i < tabsLength; i += 1) {
      aTab = tabs[i];
      console.log("getTabsInfo: i=" + i + " tab.id=" + aTab.id);
      tabId = chrome.processes.getProcessIdForTab(aTab.id, function(processId) {
        console.log("getTabsInfo: processId=" + processId);
      });
      console.log("getTabsInfo: tabId=" + tabId);
    }
  } else {
    console.log("getTabsInfo: tabs null/undefined/empty");
  }
}

/* Check now and once a minute on all tabs to have current processIds */
chrome.tabs.query({}, getTabAndProcessIds);
var tabAndProcessPID = setInterval(function() {
    chrome.tabs.query({}, getTabAndProcessIds);
}, 60000);

chrome.tabs.query({}, getTabsInfo);

chrome.processes.onExited.addListener(function (processId, exitType, exitCode) {
  console.log("onExited: processId=" + processId + " exitType=" + exitType + " exitCode=" + exitCode);

  if(exitType !== 0){
    console.log("onExited: reloading tab");
    chrome.tabs.reload();
  }
});

chrome.processes.onUnresponsive.addListener(function (process){
  console.log("unUnresponsive: id=" + process.id + " os procid=" + process.osProcessId + " type=" + process.type);

  // process.type is one of:
  //  "browser", "renderer", "extension", "notification", "plugin", "worker", "nacl", "utility", "gpu", "other"
  if(process.type === "browser" || process.type === "renderer"){
    // chrome.tabs.reload();
  }
});
