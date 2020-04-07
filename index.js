const { App } = require('@slack/bolt');

// *** Initialize an app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

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
  var dbUsers=[];
  var users = db.get(chore).value() // Find all users in the collection
  if (users) {
    users.forEach(function(user) {
      //const user = await app.client.users.profile.get({user: body.user.id});
      //console.log(user);
      dbUsers.push([user.name]); // adds their info to the dbUsers value
    });
    text = text + dbUsers.join(", ") + " did it recently.";
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
app.action('i_will_do', async({context, action, body, ack, say}) => {
  // Acknowledge action request
  ack();
  
  const actionData = JSON.parse(action.value);
  
  // post in the channel, that actionData.user will do the chore
  const post = await app.client.chat.postMessage({
    // The token you used to initialize your app is stored in the `context` object
    token: context.botToken,
    channel: actionData.channel,
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



// *** Responding a message containing a red circle emoji ***
app.message(':red_circle:', async ({message, say}) => {
  console.log(message);
  const {channel, ts, user} = message;
  
  let message_blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Who want's to do the review today?"
      },
      "accessory": {
        "type": "button",
        "text": {
          "type": "plain_text",
          "text": "I will do it!"
        },
        "style": "primary",
        "value": JSON.stringify({ts: ts, channel: channel, user: user}),
        "action_id": "i_will_do"
      }
    }
  ];
  
  // Respond to the message with a button
  say({
    blocks: message_blocks
  });
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
})();