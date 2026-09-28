import UIKit
import AVFoundation
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // звукът на играта се чува и при включен бутон „тихо“ (в играта има ЗВУК вкл./изкл.), музиката от други приложения не спира
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // екранът не угасва, докато играеш
        application.isIdleTimerDisabled = true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        application.isIdleTimerDisabled = false
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// Екранът на играта: цял екран, само хоризонтално, без часовник/батерия горе.
// Плъзгането от ръба (напр. отдолу — към началния екран) иска второ плъзгане, за да не излезеш по погрешка от джойстика.
class GameViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        guard let webView = webView else { return }
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.isOpaque = true
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        if #available(iOS 16.4, *) { webView.isInspectable = true } // Safari → Develop → iPhone (за проверки)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeRight }
}
