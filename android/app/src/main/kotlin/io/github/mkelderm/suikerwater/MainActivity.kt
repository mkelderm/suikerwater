package io.github.mkelderm.suikerwater

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.os.SystemClock
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Toont de webapp uit web/ in een WebView.
 *
 * De bestanden zitten als assets in de APK. WebViewAssetLoader levert ze uit
 * onder https://appassets.androidplatform.net/assets/, een vast adres dat nooit
 * het netwerk op gaat. Dat moet https zijn en geen file://: alleen dan laden de
 * ES-modules (app.js importeert calc.js) en werkt localStorage, waarin de app je
 * invoer bewaart.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    /** Gezet zodra het paginaproces is weggevallen; de WebView is dan onbruikbaar. */
    private var rendererGone = false

    /** Wanneer deze activity begon, om een herstartlus te herkennen. */
    private val startedAt = SystemClock.uptimeMillis()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android 15+ tekent elke app tot onder de systeembalken. Dit doet dat ook
        // op oudere versies, met vanzelf lichte of donkere iconen in de balken.
        // De marges hieronder houden de pagina zelf er vrij van.
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Alleen een debug-build is te inspecteren via chrome://inspect.
        WebView.setWebContentsDebuggingEnabled(
            applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        )

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            // Tot de pagina er staat de kleur van de pagina, geen witte flits.
            setBackgroundColor(getColor(R.color.page))
            webViewClient = AppClient(assets)
        }

        // Een WebView negeert padding, dus de marges voor systeembalken, notch en
        // toetsenbord komen op een laag eromheen. Zonder de ime-marge zou het
        // toetsenbord sinds Android 15 over de velden schuiven in plaats van de
        // pagina kleiner te maken.
        val root = FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.page))
            addView(webView)
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime()
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!rendererGone) webView.saveState(outState)
    }

    override fun onDestroy() {
        if (!rendererGone) webView.destroy()
        super.onDestroy()
    }

    private inner class AppClient(private val assets: WebViewAssetLoader) : WebViewClient() {

        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest,
        ): WebResourceResponse? = assets.shouldInterceptRequest(request.url)

        // De pagina draait in een apart proces. Valt dat weg (geheugentekort,
        // een fout in Chromium), dan sleept de standaardafhandeling de hele app
        // mee. Opnieuw opbouwen is genoeg: de invoer staat al in localStorage.
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            rendererGone = true
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            // Valt het proces vlak na het opstarten alweer weg, dan zou opnieuw
            // beginnen een eindeloze lus worden. Dan liever de app sluiten.
            if (SystemClock.uptimeMillis() - startedAt < RESTART_GUARD_MS) finish() else recreate()
            return true
        }

        // Alles van de app zelf blijft in de WebView. Een link naar buiten -- die
        // er nu niet is -- gaat naar de browser in plaats van hierbinnen te openen.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
            try {
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
            } catch (_: ActivityNotFoundException) {
                // Geen app die de link kan openen; dan gebeurt er niets.
            }
            return true
        }
    }

    private companion object {
        const val START_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/index.html"
        const val RESTART_GUARD_MS = 5_000L
    }
}
