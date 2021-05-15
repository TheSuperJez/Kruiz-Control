class ShoutOutHandler extends Handler {
  /**
   * Create a new PlayVideo handler.
   */
  constructor() {
    super('ShoutOut', []);
    this.success();
  }

  /**
   * Handle the input data (take an action).
   * @param {array} triggerData contents of trigger line
   */
  async handleData(triggerData) {
    let message = triggerData[1];
    if (message) {
      var data = await this.shoutOut(message);
      return { api_data: data };
    }
  }

  /**
   * Call the input url and return the response.
   * @param {string} url PlayVideo to play
   */
  async shoutOut(params) {
    const pageContent = $('#content');
    if (pageContent && pageContent.children() && pageContent.children().length < 1) {
      let username = params.split(' ').slice(1).join('');
      username = username[0] === '@' ? username.split('').slice(1).join('') : username;
      const token = await readFile('settings/twitch/token.txt');
      const clientId = await readFile('settings/twitch/client_id.txt');
      $.ajax({
        url: `https://api.twitch.tv/helix/users?login=${username}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'client-id': clientId
        },
        method: 'GET',
        dataType: 'json',
        success: function (data) {
          console.log(data);
          const shoutOutDiv = document.createElement('div');
          const shoutOutTitleDiv = document.createElement('div');
          const shoutOutSubtitleDiv = document.createElement('div');
          const shoutOutTextDiv = document.createElement('div');
          const channelImage = document.createElement('div');
          const image = document.createElement('img');

          shoutOutDiv.classList = ['shoutoutDiv'];

          shoutOutTitleDiv.classList = ['shoutoutTitleDiv'];
          shoutOutSubtitleDiv.classList = ['shoutoutSubtitleDiv'];
          shoutOutTextDiv.classList = ['shoutoutTextDiv'];
          channelImage.classList = ['channelImage'];

          shoutOutTitleDiv.innerText = 'Canal Recomendado';
          shoutOutSubtitleDiv.innerText = data.data[0].display_name;
          shoutOutTextDiv.innerText = data.data[0].description;
          image.src = data.data[0].profile_image_url;

          channelImage.append(image);
          shoutOutDiv.append(shoutOutTitleDiv);
          shoutOutDiv.append(shoutOutSubtitleDiv);
          shoutOutDiv.append(shoutOutTextDiv);
          shoutOutDiv.append(channelImage);
          pageContent.append(shoutOutDiv);
          pageContent.fadeIn(400);
        }
      });

      setTimeout(function () {
        pageContent.fadeOut(400, function () {
          pageContent.empty();
        });
      }, 10000);
      return username;
    } else {
      return setTimeout(() => this.shoutOut(params), 1000);
    }
  }
}

/**
 * Create a handler
 */
function shoutOutHandlerExport() {
  var shoutOut = new ShoutOutHandler();
};

shoutOutHandlerExport();
