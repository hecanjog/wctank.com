/**
 * @module posts
 */ 

import $ from "jquery";
import * as div from "./div";
import * as gMap from "./gMap";
import loading_img from "../assets/loading_cur.svg!systemjs/plugin-text";


export function renderTemplate(post, template)
{
    let content = '';
    if(typeof post.title !== 'undefined') {
        if(post.type === "link") {
            content += `<a target='_blank' href="${post.url}">${post.title}</a></div>`;
        } else {
            content += `<div class='post-title'>${post.title}</div>`;
        }
    }
    if(typeof post.body !== 'undefined') {
        content += `<div class='post-body'>${post.body}</div>`;
    }
    if(typeof post.photos !== 'undefined') {
        content += `<img src="${post.photos[0].alt_sizes[0].url}"/>`;
    }
    if(typeof post.text !== 'undefined') {
        content += `<div class='post-text'>${post.text}</div>`;
    }
    if(typeof post.player !== 'undefined') {
        content += Array.isArray(post.player) ? post.player[0].embed_code : post.player;
    }
    if(typeof post.description !== 'undefined') {
        content += `<div class='post-description'>${post.description}</div>`;
    }
    if(typeof post.caption !== 'undefined') {
        content += `<div class='post-caption'>${post.caption}</div>`;
    }
    if(typeof post.source !== 'undefined') {
        content += post.source;
    }
    
    let post_data = {
        'type': post.type,
        'date': post.date,
        'link': post.short_url,
        'content': content
    };
    
    let rendered = $template.html();
    
    $.each(post_data, (i, v) => {
        let rg = "~!" + i;
        let r = new RegExp(rg, "g");
        rendered = template.replace(r, v);
    });
    
    return rendered;
}


let throttle = false,
    throttle_interval = 500,
    text_posts = ['text', 'audio', 'link', 'quote'];


export function get(visibleBounds, callback)
{
    let sw = visibleBounds.getSouthWest(),
        ne = visibleBounds.getNorthEast(),
        url = `/posts/${sw.lat()}/${sw.lng()}/${ne.lat()}/${ne.lng()}`;

    if (!throttle) {
        $.getJSON(url, (data) => {
            throttle = true;
            window.setTimeout(() => { throttle = false; }, throttle_interval);
        
            for (let post of data) {
                post.markerType = (() => {
                    if(post.tags.find(x => x === "videos")) {
                        return 'video';   
                       // TODO: generic audio tag 
                    } else if (post.tags.find(x => x === "stumblesome")) {
                        return 'stumble';
                    } else {
                        return 'random';
                    }
                }());
               
                post.isTextPost = text_posts.find(x => x === post.type);
            }
            callback(data);
        });
    }
}


// everything below this point manages post display behavior

let display_status = {
    visible: false,
    postType: null,
    content: null
};
let statusInvisible = () => {
    display_status.visible = false;
    display_status.postType = null;
    display_status.content = "";
};
let post_event = new CustomEvent('post_overlay', {
    "bubbles": false,
    "cancelable": true,
    "detail": display_status
});

let iframeMouseStatus = {status: null};
let overlay_iframe_mouse = new CustomEvent('overlay_iframe_mouse', {
    "bubbles": false,
    "cancelable": true,
    "detail": iframeMouseStatus
});

let marker_clicked = false,
    width = 0;


export function display(post)
{
    let small_swap_time = 130;  // fade duration for content swaps
    
    if (div.$overlay.is(':hidden')) {
        div.$overlay.fadeIn('fast');
        
        // c.f. '@small' in styles
        // 'auto' fills screen when @small
        let mm = window.matchMedia("screen and (max-width: 31em)"); 
        width = mm.matches ? 'auto' : div.$overlay.css('min-width');
    } else {
        width = div.$overlay.css("width");
    } 
    div.$overlay.find("*").fadeOut(small_swap_time).remove();

    let $post = renderTemplate(post, $('#post-template'));
    div.$overlay.html($post).removeClass().addClass(post.type);

    let $contents = div.$overlay.find("*"),
        waiting = true,
        $loading = null;   

    if (!post.isTextPost) {
        div.$overlay.css("width", width);
        $contents.hide();
        
        window.setTimeout(function() {
            if (waiting) $loading = div.$overlay.append(loading_img).find("#loading");
        }, 300);
        
        $contents.load(() => {
            if ($loading) $loading.fadeOut(trivial).remove(); 
            div.$overlay.css("width", "auto");
            $contents.fadeIn(trivial);
            waiting = false;

            let $iframe = $contents.find('iframe');
            $iframe.mouseover(() => {
                iframeMouseStatus.status = 'mouseover';
                window.dispatchEvent(overlay_iframe_mouse);
            });
            $iframe.mouseout(() => {
                iframeMouseStatus.status = 'mouseout';
                window.dispatchEvent(overlay_iframe_mouse);
            });
        });
    } else {
        $contents.fadeIn(trivial); // for now, just fade in if text ...or instagram
    }

    status.visible = true;
    status.postType = post.type;        
    status.content = $post;
    document.dispatchEvent(post_event);

    marker_clicked = true;
    window.setTimeout(function() {
        marker_clicked = false;
    }, 200);
}


// Close overlay when user clicks on the X
$(document).on('click', '.close-post', function(e) {
    e.preventDefault();
    width = 'auto';
    $(this).parent().fadeOut('fast', function() {
        $(this).find("*").html("");
    });
    statusInvisible();
    document.dispatchEvent(post_event);
});

// Close overlay on mousedown over map, i.e., to move it.
div.$map.mousedown(function() {
    window.setTimeout(function() {
        if (div.$overlay.is(':visible') && div.$overlay.css('opacity') === '1' && 
                marker_clicked === false) {
            div.$overlay.fadeOut('fast', function() {
                $(this).find("*").html("");
            });
            statusInvisible();
            document.dispatchEvent(post_event);
        }
    }, 150);
});
