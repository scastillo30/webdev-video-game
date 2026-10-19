(function(){
  'use strict';

  // Configure real Atlassian account IDs here. Keep credentials and API tokens server-side.
  // Example: "712020:stable-atlassian-account-id": "commander"
  const userCharacterMap={};

  window.JIRA_ACTIVITY_CONFIG=Object.freeze({
    pollIntervalMs:60000,
    displayDurationMs:15000,
    announceOnlyToday:true,
    staleAfterMs:180000,
    historyLimit:30,
    issueBaseUrl:'',
    userCharacterMap:Object.freeze(userCharacterMap)
  });

  // These mappings and events exist only for ?jiraDemo=1. They are not real-user mappings.
  window.JIRA_DEMO_CONFIG=Object.freeze({
    examplesUrl:'jira/examples.json?v=1',
    userCharacterMap:Object.freeze({
      'example-gilberth-vasquez':'guardian',
      'example-alejandro-yglesias':'rogue',
      'example-sebastian-castillo':'commander',
      'example-gretchen-hutt':'healer',
      'example-julian-sedo':'swordsman'
    })
  });
})();
