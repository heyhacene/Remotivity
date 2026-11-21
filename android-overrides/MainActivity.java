package com.heyhacene.remotivity;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String CHROME_MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

    private LinearLayout portalContainer;
    private WebView portalWebView;
    private TextView portalTitleView;
    private ProgressBar progressBar;
    private volatile String currentPortalUrl = "";
    private OnBackPressedCallback portalBackCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView bridgeWebView = getBridge() != null ? getBridge().getWebView() : null;
        if (bridgeWebView != null) {
            configureWebViewSettings(bridgeWebView);
            bridgeWebView.addJavascriptInterface(new RemotivityBridge(), "RemotivityNative");
        }

        setupPortalOverlay();

        portalBackCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                if (portalContainer != null && portalContainer.getVisibility() == View.VISIBLE) {
                    if (portalWebView != null && portalWebView.canGoBack()) {
                        portalWebView.goBack();
                    } else {
                        hidePortalInternal();
                    }
                }
            }
        };
        getOnBackPressedDispatcher().addCallback(this, portalBackCallback);
    }

    private void configureWebViewSettings(WebView wv) {
        WebSettings settings = wv.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(CHROME_MOBILE_UA);

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(wv, true);
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
    }

    private Drawable createPillBackground(String hexColor, String strokeHex) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(Color.parseColor(hexColor));
        gd.setCornerRadius(dp(10));
        if (strokeHex != null) {
            gd.setStroke(dp(1), Color.parseColor(strokeHex));
        }
        return gd;
    }

    private Button createToolbarButton(String label, String bgHex, String textHex, String strokeHex) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        btn.setTextColor(Color.parseColor(textHex));
        btn.setBackground(createPillBackground(bgHex, strokeHex));
        btn.setPadding(dp(10), 0, dp(10), 0);
        btn.setMinWidth(0);
        btn.setMinimumWidth(0);
        btn.setMinHeight(0);
        btn.setMinimumHeight(0);
        return btn;
    }

    private void setupPortalOverlay() {
        ViewGroup rootContent = findViewById(android.R.id.content);
        if (rootContent == null) return;

        portalContainer = new LinearLayout(this);
        portalContainer.setOrientation(LinearLayout.VERTICAL);
        portalContainer.setBackgroundColor(Color.parseColor("#060913"));
        portalContainer.setVisibility(View.GONE);
        portalContainer.setClickable(true);
        portalContainer.setFocusable(true);

        ViewCompat.setOnApplyWindowInsetsListener(portalContainer, (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setBackgroundColor(Color.parseColor("#060913"));
        toolbar.setPadding(dp(10), dp(4), dp(10), dp(4));

        Button homeBtn = createToolbarButton("⌂ Accueil", "#0E7490", "#FFFFFF", "#22D3EE");
        homeBtn.setOnClickListener(v -> hidePortalInternal());
        toolbar.addView(homeBtn, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(34)
        ));

        portalTitleView = new TextView(this);
        portalTitleView.setText("Antigravity Remote");
        portalTitleView.setTextColor(Color.WHITE);
        portalTitleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        portalTitleView.setSingleLine(true);
        portalTitleView.setGravity(Gravity.CENTER_VERTICAL);
        portalTitleView.setPadding(dp(10), 0, dp(8), 0);
        toolbar.addView(portalTitleView, new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        ));

        Button pinBtn = createToolbarButton("📌 Garder", "#1E293B", "#67E8F9", "#334155");
        pinBtn.setOnClickListener(v -> {
            String url = portalWebView != null && portalWebView.getUrl() != null
                ? portalWebView.getUrl()
                : currentPortalUrl;
            if (url != null && url.startsWith("http")) {
                currentPortalUrl = url;
                WebView bridgeWebView = getBridge() != null ? getBridge().getWebView() : null;
                if (bridgeWebView != null) {
                    String js = "window.dispatchEvent(new CustomEvent('remotivity-pin-url', { detail: "
                        + JSONObject.quote(url) + " }));";
                    bridgeWebView.evaluateJavascript(js, null);
                }
                Toast.makeText(MainActivity.this, "Session mémorisée", Toast.LENGTH_SHORT).show();
            }
        });
        LinearLayout.LayoutParams pinParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(34)
        );
        pinParams.setMargins(0, 0, dp(6), 0);
        toolbar.addView(pinBtn, pinParams);

        Button reloadBtn = createToolbarButton("↻", "#1E293B", "#FFFFFF", "#334155");
        reloadBtn.setOnClickListener(v -> {
            if (portalWebView != null) portalWebView.reload();
        });
        toolbar.addView(reloadBtn, new LinearLayout.LayoutParams(dp(36), dp(34)));

        portalContainer.addView(toolbar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(42)
        ));

        // Slim cyan progress bar
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setVisibility(View.GONE);
        LayerDrawable progressDrawable = new LayerDrawable(new Drawable[] {
            new ColorDrawable(Color.parseColor("#0F172A")),
            new ClipDrawable(new ColorDrawable(Color.parseColor("#22D3EE")), Gravity.LEFT, ClipDrawable.HORIZONTAL)
        });
        progressDrawable.setId(0, android.R.id.background);
        progressDrawable.setId(1, android.R.id.progress);
        progressBar.setProgressDrawable(progressDrawable);
        portalContainer.addView(progressBar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        ));

        portalWebView = new WebView(this);
        configureWebViewSettings(portalWebView);
        portalWebView.getSettings().setLoadWithOverviewMode(true);
        portalWebView.getSettings().setUseWideViewPort(true);
        portalWebView.getSettings().setBuiltInZoomControls(true);
        portalWebView.getSettings().setDisplayZoomControls(false);

        portalWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar == null) return;
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        portalWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                if (url != null) {
                    currentPortalUrl = url;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null) {
                    currentPortalUrl = url;
                }
                CookieManager.getInstance().flush();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        portalContainer.addView(portalWebView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));

        rootContent.addView(portalContainer, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    private void openPortalInternal(String url, String title) {
        if (portalContainer == null || portalWebView == null) return;
        if (title != null && !title.trim().isEmpty() && portalTitleView != null) {
            portalTitleView.setText(title);
        }
        portalContainer.setVisibility(View.VISIBLE);
        portalContainer.bringToFront();
        if (portalBackCallback != null) {
            portalBackCallback.setEnabled(true);
        }
        String loaded = portalWebView.getUrl();
        if (url != null && !url.trim().isEmpty() && (loaded == null || !loaded.equals(url))) {
            if (loaded == null || loaded.isEmpty() || !loaded.startsWith(url)) {
                portalWebView.loadUrl(url);
            }
        }
    }

    private void hidePortalInternal() {
        if (portalContainer != null) {
            portalContainer.setVisibility(View.GONE);
        }
        if (portalBackCallback != null) {
            portalBackCallback.setEnabled(false);
        }
        CookieManager.getInstance().flush();
        WebView bridgeWebView = getBridge() != null ? getBridge().getWebView() : null;
        if (bridgeWebView != null) {
            bridgeWebView.evaluateJavascript("window.dispatchEvent(new CustomEvent('remotivity-portal-hidden'));", null);
        }
    }

    public class RemotivityBridge {
        @JavascriptInterface
        public boolean isNativePortalSupported() {
            return true;
        }

        @JavascriptInterface
        public void openPortal(String url, String title) {
            runOnUiThread(() -> openPortalInternal(url, title));
        }

        @JavascriptInterface
        public void hidePortal() {
            runOnUiThread(MainActivity.this::hidePortalInternal);
        }

        @JavascriptInterface
        public String getCurrentPortalUrl() {
            return currentPortalUrl != null ? currentPortalUrl : "";
        }
    }
}
