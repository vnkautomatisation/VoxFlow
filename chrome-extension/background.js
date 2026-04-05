// VoxFlow — ouvre un onglet au clic
chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ url: "http://localhost:3001/*" }, tabs => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true })
      chrome.windows.update(tabs[0].windowId, { focused: true })
    } else {
      chrome.tabs.create({ url: "http://localhost:3001/admin/dashboard" })
    }
  })
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("[VoxFlow] Extension installee")
})
