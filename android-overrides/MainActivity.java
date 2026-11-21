package com.heyhacene.remotivity;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
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
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CHROME_MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

    private LinearLayout portalContainer;
    private WebView portalWebView;
    private TextView portalTitleView;
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
        toolbar.setBackgroundColor(Color.parseColor("#0B1120"));
        toolbar.setPadding(dp(10), dp(8), dp(10), dp(8));

        Button backBtn = new Button(this);
        backBtn.setText("← Cockpit");
        backBtn.setAllCaps(false);
        backBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        backBtn.setTextColor(Color.WHITE);
        backBtn.setBackgroundColor(Color.parseColor("#0E7490"));
        backBtn.setPadding(dp(10), dp(4), dp(10), dp(4));
        backBtn.setOnClickListener(v -> hidePortalInternal());
        toolbar.addView(backBtn, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(36)
        ));

        portalTitleView = new TextView(this);
        portalTitleView.setText("Antigravity Remote");
        portalTitleView.setTextColor(Color.WHITE);
        portalTitleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        portalTitleView.setSingleLine(true);
        portalTitleView.setPadding(dp(10), 0, dp(10), 0);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        toolbar.addView(portalTitleView, titleParams);

        Button copyBtn = new Button(this);
        copyBtn.setText("URL");
        copyBtn.setAllCaps(false);
        copyBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        copyBtn.setTextColor(Color.parseColor("#67E8F9"));
        copyBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        copyBtn.setPadding(dp(8), dp(4), dp(8), dp(4));
        copyBtn.setOnClickListener(v -> {
            String url = portalWebView != null && portalWebView.getUrl() != null
                ? portalWebView.getUrl()
                : currentPortalUrl;
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null && url != null) {
                clipboard.setPrimaryClip(ClipData.newPlainText("Remotivity URL", url));
                Toast.makeText(MainActivity.this, "URL de session copiée", Toast.LENGTH_SHORT).show();
            }
        });
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(36)
        );
        copyParams.setMargins(0, 0, dp(6), 0);
        toolbar.addView(copyBtn, copyParams);

        Button reloadBtn = new Button(this);
        reloadBtn.setText("↻");
        reloadBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        reloadBtn.setTextColor(Color.WHITE);
        reloadBtn.setBackgroundColor(Color.parseColor("#1E293B"));
        reloadBtn.setPadding(dp(8), dp(2), dp(8), dp(2));
        reloadBtn.setOnClickListener(v -> {
            if (portalWebView != null) portalWebView.reload();
        });
        toolbar.addView(reloadBtn, new LinearLayout.LayoutParams(dp(40), dp(36)));

        portalContainer.addView(toolbar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        portalWebView = new WebView(this);
        configureWebViewSettings(portalWebView);
        portalWebView.getSettings().setLoadWithOverviewMode(true);
        portalWebView.getSettings().setUseWideViewPort(true);
        portalWebView.getSettings().setBuiltInZoomControls(true);
        portalWebView.getSettings().setDisplayZoomControls(false);

        portalWebView.setWebChromeClient(new WebChromeClient());
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
