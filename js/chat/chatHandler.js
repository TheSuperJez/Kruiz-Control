class ChatHandler extends Handler {
  /**
   * Create a new Chat handler.
   */
  constructor() {
    super('Chat', ['OnCommand','OnKeyword','OnEveryChatMessage','OnSpeak']);

    /* OnCommand */
    this.commands = [];
    this.commandsOther = [];
    this.commandsInfo = {};

    /* OnKeyword */
    this.keywords = [];
    this.keywordsRegex = null;
    this.keywordsInfo = {};

    /* OnSpeak */
    this.speaks = [];
    this.speaksInfo = {};
    this.speakers = {};

    /* OnEveryChatMessage */
    this.chatTriggers = [];
  }

  /**
   * Initialize the chat connection with the input user.
   * @param {string} user twitch channel to connect
   * @param {string} oauth twitch irc oauth to send messages
   */
  init(user, oauth) {
    this.channel = user.toLowerCase();
    ComfyJS.onConnected = ( address, port, isFirstConnect ) => {
      if (isFirstConnect) {
        this.success();
      }
    }
    if (user) {
      if (oauth) {
        ComfyJS.Init(user, oauth);
      } else {
        ComfyJS.Init(user);
      }
    }
  }

  objectPath(obj, path) {
    for (var i = 0, path = path.split('.'), len = path.length; i < len; i++) {
      obj = obj[path[i]];
    };
    return obj;
  };

  async getTwitchData(username) {
    const token = await readFile('settings/twitch/token.txt');
    const clientId = await readFile('settings/twitch/client_id.txt');
    let twitchData = {};
    try {
      const response = await $.ajax({
        url: `https://api.twitch.tv/helix/streams?user_login=${username}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'client-id': clientId
        }
      });
      twitchData.startedAt = _.get(response, 'data[0].started_at', 'Offline');
      twitchData.gameName = _.get(response, 'data.0.game_name', 'Offline.');
      twitchData.title = _.get(response, 'data.0.title', 'Offline.');
      twitchData.viewerCount = _.get(response, 'data.0.viewer_count', 'Offline.');
      twitchData.uptime = moment(twitchData.startedAt, "YYYY-MM-DDTHH:mm:ssZ").utc().fromNow();
      twitchData.uptime = twitchData.uptime === 'Invalid date' ? 'Offline' : twitchData.uptime;
    } catch (exception) {
      twitchData.error = exception;
    }
    return twitchData;
  }

  /**
   * Register trigger from user input.
   * @param {string} trigger name to use for the handler
   * @param {array} triggerLine contents of trigger line
   * @param {number} id of the new trigger
   */
  addTriggerData(trigger, triggerLine, triggerId) {
    trigger = trigger.toLowerCase();
    switch (trigger) {
      case 'oncommand':
        var command = '';
        var info = '';
        var cooldown = 0;
        var permission = triggerLine[1].toLowerCase();
        if (permission.includes('u')) {
          info = triggerLine[2].toLowerCase();
          cooldown = triggerLine[3];
          command = triggerLine[4].toLowerCase();
        } else {
          cooldown = triggerLine[2];
          command = triggerLine[3].toLowerCase();
        }
        if (command.charAt(0) === "!") {
          command = command.substring(1);
          if (this.commands.indexOf(command) === -1) {
            this.commands.push(command);
            this.commandsInfo[command] = [];
          }
        } else {
          if (this.commandsOther.indexOf(command) === -1) {
            this.commandsOther.push(command);
            this.commandsInfo[command] = [];
          }
        }
        cooldown = parseInt(cooldown);
        if (isNaN(cooldown)) {
          cooldown = 0;
        }
        this.commandsInfo[command].push({
          permission: permission,
          info: info,
          trigger: triggerId,
          cooldown: cooldown * 1000,
          lastUse: 0 - (cooldown * 1000)
        });
        break;
      case 'onkeyword':
        var keyword = '';
        var info = '';
        var cooldown = 0;
        var permission = triggerLine[1].toLowerCase();
        if (permission.includes('u')) {
          info = triggerLine[2].toLowerCase();
          cooldown = triggerLine[3];
          keyword = triggerLine.slice(4).join(' ');
        } else {
          cooldown = triggerLine[2];
          keyword = triggerLine.slice(3).join(' ');
        }
        keyword = keyword.toLowerCase();
        cooldown = parseInt(cooldown);
        if (isNaN(cooldown)) {
          cooldown = 0;
        }
        if (this.keywords.indexOf(keyword) === -1) {
          this.keywords.push(keyword);
          this.keywordsInfo[keyword] = [];
        }
        this.keywordsInfo[keyword].push({
          permission: permission,
          info: info,
          trigger: triggerId,
          cooldown: cooldown * 1000,
          lastUse: 0 - (cooldown * 1000)
        });
        break;
      case 'onspeak':
        var user = triggerLine.slice(1).join(' ').toLowerCase();
        if (this.speaks.indexOf(user) === -1) {
          this.speaks.push(user);
          this.speaksInfo[user] = [];
        }
        this.speaksInfo[user].push(triggerId);
        break;
      case 'oneverychatmessage':
        this.chatTriggers.push(triggerId);
        break;
      default:
        // do nothing
    }
    return;
  }

  /**
   * Handle the input data (take an action).
   * @param {array} triggerData contents of trigger line
   */
  async handleData(triggerData) {
    var trigger = triggerData[1].toLowerCase();
    if (trigger === 'send') {
      const username = await readFile('settings/twitch/user.txt');
      const data = await this.getTwitchData(username);
      const formattedMessage = triggerData.slice(2).join(' ')
      .replace(/{uptime}/g, data.uptime)
      .replace(/{startedAt}/g, data.startedAt)
      .replace(/{gameName}/g, data.gameName)
      .replace(/{title}/g, data.title)
      .replace(/{viewerCount}/g, data.viewerCount);
      ComfyJS.Say(formattedMessage);
    } else if (trigger === 'whisper') {
      ComfyJS.Whisper(triggerData.slice(3).join(' '), triggerData[2]);
    }
    return;
  }

  /**
   * Register trigger from user input.
   * @param {string} user twich username that sent message
   * @param {object} flags permission flags for the user
   * @param {string} permissions usability of the command or keyword
   * @param {string} info extra information for the usability
   */
  checkPermissions(user, flags, permissions, info) {
    user = user.toLowerCase();
    if (
      (permissions.includes('e')) ||
      (permissions.includes('s') && flags.subscriber) ||
      (permissions.includes('v') && flags.vip) ||
      (permissions.includes('f') && flags.founder) ||
      (permissions.includes('m') && flags.mod) ||
      (permissions.includes('b') && this.channel === user) ||
      (permissions.includes('u') && info && user === info)
    ){
      return true;
    }
    return false;
  }

  /**
   * Check if a trigger is on cooldown.
   * @param {object} info command info object
   */
  updateCooldown(info) {
    if (info.cooldown === 0) {
      return true;
    }

    var curTime = new Date().getTime();
    if (curTime >= info.lastUse + info.cooldown) {
      info.lastUse = curTime;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Called after parsing all user input.
   */
  postParse() {
    // Create Keyword Regex
    if (this.keywords.length > 0) {
      this.keywordsRegex = new RegExp('(?:\\b|^|\\s)' + this.keywords.map(x => escapeRegExp(x)).join('(?:\\b|$|\\s)|(?:\\b|^|\\s)') + '(?:\\b|$|\\s)', 'gi');
    }

    ComfyJS.onCommand = ( user, command, message, flags, extra ) => {
      var combined = '!' + command + ' ' + message;

      this.onAllChat(user, {
        user: user,
        message: combined,
        data: {
          user: user,
          command: command,
          message: combined,
          after: message,
          flags: flags,
          extra: extra
        }
      });

      // Check for matching command and user permission
      if (this.commands.indexOf(command) !== -1) {
        var args = [];
        try {
          args = shlexSplit(message);
        } catch (err) {
          args = message.split(' ');
        }

        var chatArgs = {};
        for (var i = 0; i < args.length; i++) {
          chatArgs[`arg${i+1}`] = args[i];
        }
        this.commandsInfo[command].forEach(info => {
          if (this.checkPermissions(user, flags, info.permission, info.info) && this.updateCooldown(info)) {
            controller.handleData(info.trigger, {
              user: user,
              message: combined,
              after: message,
              data: {
                user: user,
                command: command,
                message: combined,
                after: message,
                flags: flags,
                extra: extra
              },
              ...chatArgs
            });
          }
        });
      }
      // Otherwise, check for keyword match
      else {
        var result = message.match(this.keywordsRegex);
        if (result) {
          var match = result[0].trim().toLowerCase();
          var args = [];
          try {
            args = shlexSplit(message);
          } catch (err) {
            args = message.split(' ');
          }
          var chatArgs = {};
          for (var i = 0; i < args.length; i++) {
            chatArgs[`arg${i+1}`] = args[i];
          }
          this.keywordsInfo[match].forEach(info => {
            // Check if user has permission to trigger keyword
            if (this.checkPermissions(user, flags, info.permission, info.info) && this.updateCooldown(info)) {
              controller.handleData(info.trigger, {
                user: user,
                message: message,
                data: {
                  user: user,
                  keyword: match,
                  message: message,
                  flags: flags,
                  extra: extra
                },
                ...chatArgs
              });
            }
          });
        }
      }
    }

    ComfyJS.onChat = ( user, message, flags, self, extra ) => {
      this.onAllChat(user, {
        user: user,
        message: message,
        data: {
          user: user,
          message: message,
          flags: flags,
          extra: extra
        }
      });

      // Check for matching command and user permission
      var command = message.split(' ')[0];
      if(this.commandsOther.indexOf(command) != -1) {
        var args = [];
        try {
          args = shlexSplit(message);
        } catch (err) {
          args = message.split(' ');
        }
        var chatArgs = {};
        for (var i = 0; i < args.length; i++) {
          chatArgs[`arg${i+1}`] = args[i];
        }
        this.commandsInfo[command].forEach(info => {
          if (this.checkPermissions(user, flags, info.permission, info.info) && this.updateCooldown(info)) {
            var after = message.split(' ').slice(1).join(' ');
            controller.handleData(info.trigger, {
              user: user,
              message: message,
              after: after,
              data: {
                user: user,
                command: command,
                message: message,
                after: after,
                flags: flags,
                extra: extra
              },
              ...chatArgs
            });
          }
        });
      }
      // Otherwise, check for keyword match
      else {
        var result = message.match(this.keywordsRegex);
        if (result) {
          var args = [];
          try {
            args = shlexSplit(message);
          } catch (err) {
            args = message.split(' ');
          }
          var chatArgs = {};
          for (var i = 0; i < args.length; i++) {
            chatArgs[`arg${i+1}`] = args[i];
          }
          var match = result[0].trim().toLowerCase();
          this.keywordsInfo[match].forEach(info => {
            // Check if user has permission to trigger keyword
            if (this.checkPermissions(user, flags, info.permission, info.info) && this.updateCooldown(info)) {
              controller.handleData(info.trigger, {
                user: user,
                message: message,
                data: {
                  user: user,
                  keyword: match,
                  message: message,
                  flags: flags,
                  extra: extra
                },
                ...chatArgs
              });
            }
          });
        }
      }
    }
    return;
  }

  /**
   * Check if a trigger is on cooldown.
   * @param {strng} user that sent the message
   * @param {data} data to send with the OnEveryChatMessage
   */
  onAllChat(user, data) {
	// OnEveryChatMessage
    this.chatTriggers.forEach(triggerId => {
      controller.handleData(triggerId, data);
    });

    // Check for OnSpeak Event
    var userLower = user.toLowerCase();
    var onSpeakTriggers = [];
    if (this.speakers[userLower] === undefined && this.speaks.indexOf(userLower) !== -1) {
      onSpeakTriggers.push(...this.speaksInfo[userLower]);
    }
    if (this.speakers[userLower] === undefined && this.speaks.indexOf('*') !== -1) {
      onSpeakTriggers.push(...this.speaksInfo['*']);
    }
    if (onSpeakTriggers.length > 0) {
      this.speakers[userLower] = true;
      onSpeakTriggers.sort((a, b) => a-b);
      onSpeakTriggers.forEach(triggerId => {
        controller.handleData(triggerId, {
          user: user
        });
      });
    } else if (this.speakers[userLower] === undefined) {
      this.speakers[userLower] = true;
    }
  }
}

/**
 * Create a handler and read user settings
 */
async function chatHandlerExport() {
  var chat = new ChatHandler();
  var user = await readFile('settings/chat/user.txt');
  var oauth = await readFile('settings/chat/oauth.txt');
  chat.init(user.trim(), oauth.trim());
}
chatHandlerExport();
