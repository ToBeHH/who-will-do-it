const { App } = require('@slack/bolt');

// *** Initialize an app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

function arrayToText(a) {
    if (a.length <= 2) {
        return a.join(' and ');
    } else {
        return a.slice(0, -1).join(', ') + ' and ' + a[a.length-1];
    }
}

// setup a new database
// persisted using async file storage
// Security note: the database is saved to the file `db.json` on the local filesystem.
// It's deliberately placed in the `.data` directory which doesn't get copied if someone remixes the project.
var low = require('lowdb')
var FileSync = require('lowdb/adapters/FileSync')
var adapter = new FileSync('.data/db.json')
var db = low(adapter)

// Listen for a slash command
app.command('/who-will-do', async ({ command, ack, say }) => {
  // Acknowledge command request
  ack();
  
  const [chore, when] = command.text.split(" ")
  
  // TODO: add, who did it last times
  let text = "Who want's to do the " + chore + " " + when + "? ";
  var users=[];
  var dbUsers = db.get(chore).value() // Find all users in the collection
  if (dbUsers) {
    for (let i=dbUsers.length - 1; i >= Math.max(0, dbUsers.length - 3); i--) {
      const slack_user = await app.client.users.info({user: dbUsers[i].id, token: process.env.SLACK_BOT_TOKEN});
      users.push(slack_user.user.real_name);
    }
    text = text + arrayToText(users) + " did it recently.";
  } else {
    const emptyDB = `{ "${chore}": [] }`
    db.defaults(JSON.parse(emptyDB)).write()
    console.log(`Database ${chore} created`);
  }
  
  let message_blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": text
      },
      "accessory": {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "I will do it!"
        },
        "value": JSON.stringify({channel: command.channel_id, chore: chore, when: when}),
        "action_id": "i_will_do"
      }
    }
  ];
  
  // Respond to the message with a button
  say({
    blocks: message_blocks
  });
});

// The middleware will be called every time an interactive component with the action_id “i_will_do" is triggered
app.action('i_will_do', async({context, action, body, ack, respond}) => {
  const actionData = JSON.parse(action.value);

  // Acknowledge action request
  ack();
  
  respond({
    replace_original: true,
    text: `<@${body.user.name}> will do the ${actionData.chore} for ${actionData.when}! Please support him as good as you can!`
  });
 
  // Thank user
  await app.client.chat.postMessage({
    // The token you used to initialize your app is stored in the `context` object
    token: context.botToken,
    channel: body.user.id,
    text: `Thank you for doing the ${actionData.chore} for ${actionData.when}!`
  });
  
  // remember user
  db.get(actionData.chore)
    .push(body.user)
    .write();
});

// *** Handle errors ***
app.error((error) => {
	// Check the details of the error to handle cases where you should retry sending a message or stop the app
	console.error(error);
});


// *** Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
  console.log(
    "Your URL for events and interactivity is: https://" +
      process.env.PROJECT_NAME +
      ".glitch.me/slack/events"
  );
})();