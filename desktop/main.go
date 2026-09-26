// The Endless March: Journey to the End - desktop launcher.
//
// The whole game is built into this one executable. On launch it serves the
// game from 127.0.0.1 and opens it in a dedicated app window
// (Microsoft Edge / Chrome / Chromium in --app mode, with its own profile so it
// behaves like a standalone program). The launcher exits when that window
// closes. If no Chromium-based browser is found, the game opens in the default
// browser instead and the launcher exits once the page stops checking in.
package main

import (
	_ "embed"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed game.html
var embeddedHTML string

//go:embed winres/icon.png
var iconPNG []byte

// Injected into the page: keeps the launcher alive while the game is open and
// lets F11 toggle fullscreen.
const launcherScript = `<script>
(function () {
  setInterval(function () { fetch('/ping', { cache: 'no-store' }).catch(function () {}); }, 2000);
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'F11') return;
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  });
})();
</script>`

func inject(html string) string {
	return strings.Replace(html, "</body>", launcherScript+"\n</body>", 1)
}

func main() {
	page := inject(embeddedHTML)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fail("Could not start the local game server:\n" + err.Error())
	}
	url := fmt.Sprintf("http://%s/", ln.Addr().String())

	var lastPing atomic.Int64
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		switch r.URL.Path {
		case "/", "/index.html":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, page)
		case "/icon.png":
			w.Header().Set("Content-Type", "image/png")
			w.Write(iconPNG)
		default:
			http.NotFound(w, r)
		}
	})
	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		lastPing.Store(time.Now().UnixNano())
		w.WriteHeader(http.StatusNoContent)
	})
	go http.Serve(ln, mux)

	if browser := findBrowser(); browser != "" {
		profile := filepath.Join(dataDir(), "window-profile")
		cmd := exec.Command(browser,
			"--app="+url,
			"--user-data-dir="+profile,
			"--window-size=1280,760",
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-features=Translate",
			"--autoplay-policy=no-user-gesture-required",
		)
		hideConsole(cmd)
		if err := cmd.Start(); err == nil {
			cmd.Wait()
			// Some browsers hand the window to an already running instance and
			// return at once; keep serving while the page is still checking in.
			waitWhileAlive(&lastPing, 8*time.Second)
			return
		}
	}

	if err := openDefault(url); err != nil {
		fail("Could not open a browser window to play The Endless March.\n\nOpen this address in any modern browser while this program is running:\n" + url)
	}
	waitWhileAlive(&lastPing, 60*time.Second)
}

// waitWhileAlive blocks until the page has stopped pinging for a while.
// `grace` is how long to wait for a first ping before giving up.
func waitWhileAlive(lastPing *atomic.Int64, grace time.Duration) {
	start := time.Now()
	for {
		time.Sleep(time.Second)
		lp := lastPing.Load()
		if lp == 0 {
			if time.Since(start) > grace {
				return
			}
			continue
		}
		if time.Since(time.Unix(0, lp)) > 6*time.Second {
			return
		}
	}
}

func dataDir() string {
	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "TheEndlessMarch")
	os.MkdirAll(dir, 0o755)
	return dir
}

func exists(p string) bool {
	if p == "" {
		return false
	}
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

func findBrowser() string {
	if p := os.Getenv("SEEK_BROWSER"); exists(p) {
		return p
	}
	for _, p := range browserCandidates() {
		if exists(p) {
			return p
		}
		if !strings.ContainsAny(p, `/\`) {
			if lp, err := exec.LookPath(p); err == nil {
				return lp
			}
		}
	}
	return ""
}
