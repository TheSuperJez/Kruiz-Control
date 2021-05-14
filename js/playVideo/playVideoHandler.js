class playVideoHandler extends Handler {
  /**
   * Create a new PlayVideo handler.
   */
  constructor() {
    super('PlayVideo', []);
    this.success();
  }

  /**
   * Handle the input data (take an action).
   * @param {array} triggerData contents of trigger line
   */
  async handleData(triggerData) {
    if (triggerData[1]) {
      let data = await this.playVideo(triggerData[1]);
      return { api_data: data };
    }
  }

  /**
   * Call the input url and return the response.
   * @param {string} url PlayVideo to play
   */
  async playVideo(url) {
    const pageContent = $('#content');
    // there's already something being displayed
    if (pageContent && pageContent.children() && pageContent.children().length < 1) {
      const videoEl = document.createElement('video');
      videoEl.setAttribute('width', '800');
      videoEl.setAttribute('src', `video/${url}`);
      videoEl.onended = function () {
        pageContent.fadeOut(400, function () {
          $(videoEl).remove();
        });
      };
      pageContent.fadeIn(400);
      pageContent.append(videoEl);
      videoEl.play();
      return url;
    } else {
      return setTimeout(() => this.playVideo(url), 1000); // try again in 1 second
    }
  }
}

/**
 * Create a handler
 */
function playVideoHandlerExport() {
  new playVideoHandler();
}
playVideoHandlerExport();
