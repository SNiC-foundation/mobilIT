function create(htmlStr) {
  let frag = document.createDocumentFragment();
  let temp = document.createElement("div");
  temp.innerHTML = htmlStr;
  while (temp.firstChild) {
    frag.appendChild(temp.firstChild);
  }
  return frag;
}

function createToast(content, type) {
  let toastStr =
    '<div class="toast align-items-center text-white bg-' +
    type +
    ' border-0" role="alert" aria-live="assertive" aria-atomic="true">' +
    '    <div class="d-flex align-items-center justify-content-between">' +
    '        <div class="toast-body">' +
    content +
    '        </div><button class="btn-close btn-close-white me-2 m-auto" type="button" data-bs-dismiss="toast" aria-label="Close"></button>' +
    "    </div>" +
    "</div>";
  let frag = create(toastStr);
  let toastContainer = document.getElementById("toastContainer");
  toastContainer.appendChild(frag);
  let toast = bootstrap.Toast.getOrCreateInstance(toastContainer.lastChild);
  toast.show();
}

function unenrollClick(talkid) {
  $.post("/api/talk/unenroll/" + talkid, {}, function (result) {
    updateCapacity();
    updateEnrolled();
    if (result.success) {
      $("#" + talkid + "-unenroll").hide();
      $("#" + talkid + "-enroll").show();
      createToast("Successfully unenrolled", "success");
    } else {
      createToast("You can't unenroll from this talk", "danger");
    }
  });
}

function enrollClick(talkid) {
  $.post("/api/talk/enroll/" + talkid, {}, function (result) {
    updateCapacity();
    updateEnrolled();
    if (result.success) {
      $("#" + talkid + "-unenroll").show();
      $("#" + talkid + "-enroll").hide();
      createToast("Successfully enrolled", "success");
    } else {
      createToast(result.error, "danger");
    }
  });
}

function updateCapacity() {
  $.get("/api/talk/count/", {}, function (result) {
    if (result.success) {
      for (const talk in result.content) {
        $("#" + talk + "-capacity").text(
          "Capacity " +
            result.content[talk].count +
            "/" +
            result.content[talk].limit
        );
      }
    } else {
      console.error("failed to get talk count", result);
    }
  });
}

function updateEnrolled() {
  $.get("/api/talk/enrolled/", {}, function (result) {
    if (result.success) {
      $(".choosable").addClass("chosen");
      for (const talk of result.content) {
        let talk_card = $("#e-" + talk + "-card");
        talk_card.parent().children().removeClass("chosen");
        talk_card.addClass("chosen");
      }
    } else {
      console.error("failed to get enrolled talks", result);
    }
  });
}
