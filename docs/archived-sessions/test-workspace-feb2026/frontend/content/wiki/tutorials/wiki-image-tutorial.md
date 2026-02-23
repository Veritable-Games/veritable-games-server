<h1>Wiki Image Tutorial</h1>
<p>Welcome to the comprehensive guide on using images in our wiki system! This tutorial covers all the ways you can add and display images in wiki pages.</p>
<h2>Table of Contents</h2>
<ul>
<li><a href="#basic-image-syntax">Basic Image Syntax</a></li>
<li><a href="#image-sizing">Image Sizing</a></li>
<li><a href="#image-alignment">Image Alignment</a></li>
<li><a href="#image-galleries">Image Galleries</a></li>
<li><a href="#best-practices">Best Practices</a></li>
</ul>
<h2>Basic Image Syntax</h2>
<p>The wiki supports standard Markdown image syntax:</p>
<h3>Simple Image</h3>
<pre><code class="language-markdown">![Alt text](/images/test-project.jpg)
</code></pre>
<img src="/images/test-project.jpg" alt="Test Project Image">

<h3>Image with Title (Tooltip)</h3>
<pre><code class="language-markdown">![Logo](/logo-icon-color.png "Veritable Games Logo")
</code></pre>
<img src="/logo-icon-color.png" alt="Logo" title="Veritable Games Logo">

<h2>Image Sizing</h2>
<p>While Markdown doesn&#39;t natively support image sizing, you can use HTML:</p>
<h3>Fixed Width</h3>
<pre><code class="language-html"><img src="/logoWhiteIcon.png" alt="Logo" width="100">
</code></pre>
<img src="/logoWhiteIcon.png" alt="Logo" width="100">

<h3>Percentage Width</h3>
<pre><code class="language-html"><img src="/logoWhiteIcon_retina.png" alt="Retina Logo" style="width: 50%;">
</code></pre>
<img src="/logoWhiteIcon_retina.png" alt="Retina Logo" style="width: 50%;">

<h2>Image Alignment</h2>
<h3>Center Aligned</h3>
<pre><code class="language-html"><div style="text-align: center;">
 <img src="/logo_text_white.png" alt="Centered Logo" width="200">
</div>
</code></pre>
<div style="text-align: center;">
 <img src="/logo_text_white.png" alt="Centered Logo" width="200">
</div>

<h3>Float Left with Text Wrap</h3>
<img src="/favicon-32x32.png" alt="Small Icon" style="float: left; margin-right: 10px;">
This text wraps around the floated image. You can use this technique to create magazine-style layouts where text flows around images.

<div style="clear: both;"></div>

<h3>Float Right with Text Wrap</h3>
<img src="/favicon-16x16.png" alt="Tiny Icon" style="float: right; margin-left: 10px;">
Similarly, you can float images to the right. This creates a different visual flow.

<div style="clear: both;"></div>

<h2>Image Galleries</h2>
<h3>Table Gallery</h3>
<table>
<thead>
<tr>
<th>Image 1</th>
<th>Image 2</th>
<th>Image 3</th>
</tr>
</thead>
<tbody><tr>
<td><img src="/logoWhiteIcon_128.png" alt="Icon 1"></td>
<td><img src="/logoWhiteIcon_optimized.png" alt="Icon 2"></td>
<td><img src="/logoWhiteIcon_soft.png" alt="Icon 3"></td>
</tr>
<tr>
<td>Version 128px</td>
<td>Optimized Version</td>
<td>Soft Version</td>
</tr>
</tbody></table>
### Grid Gallery using HTML
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
 <img src="/logo_text_white_horizontal.png" alt="Horizontal 1" style="width: 100%;">
 <img src="/logo_text_white_horizontal_crisp.png" alt="Horizontal 2" style="width: 100%;">
 <img src="/logo_text_white_horizontal_edge.png" alt="Horizontal 3" style="width: 100%;">
</div>

<h2>Symbol Collection</h2>
<p>Our wiki includes symbolic images for game documentation:</p>
<table>
<thead>
<tr>
<th>Symbol</th>
<th>Name</th>
<th>Usage</th>
</tr>
</thead>
<tbody><tr>
<td><img src="/symbols/BALANCE.png" alt="Balance"></td>
<td>Balance</td>
<td>Neutral state</td>
</tr>
<tr>
<td><img src="/symbols/DEPRESSION.png" alt="Depression"></td>
<td>Depression</td>
<td>Negative state</td>
</tr>
<tr>
<td><img src="/symbols/ELATION-PLEASURE.png" alt="Elation"></td>
<td>Elation</td>
<td>Positive state</td>
</tr>
</tbody></table>
## Image Captions
<figure style="text-align: center;">
 <img src="/logo_icon_white.png" alt="White Logo" width="150">
 <figcaption style="font-style: italic; margin-top: 5px;">
 Figure 1: The official Veritable Games logo
 </figcaption>
</figure>

<h2>Best Practices</h2>
<ol>
<li><strong>Alt Text</strong>: Always provide descriptive alt text for accessibility</li>
<li><strong>File Names</strong>: Use descriptive, lowercase filenames with hyphens</li>
<li><strong>File Size</strong>: Optimize images before uploading (< 500KB recommended)</li>
</ol>
<h2>Responsive Images</h2>
<pre><code class="language-html"><img src="/images/test-project.jpg" 
 alt="Responsive Image" 
 style="max-width: 100%; height: auto;">
</code></pre>
<p>This ensures images scale appropriately on different screen sizes.</p>
<h2>Troubleshooting</h2>
<ul>
<li><strong>Image Not Displaying</strong>: Check file path and verify file exists</li>
<li><strong>Image Too Large</strong>: Use width/height attributes or CSS</li>
<li><strong>Broken Layout</strong>: Clear floats after floated images</li>
</ul>
<hr>
<p><em>Tutorial created for demonstrating wiki image capabilities</em></p>
