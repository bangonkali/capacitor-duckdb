// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BangonkaliCapacitorDuckdb",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "BangonkaliCapacitorDuckdb",
            targets: ["CapacitorDuckDbPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "CapacitorDuckDbPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CapacitorDuckDbPlugin"),
        .testTarget(
            name: "CapacitorDuckDbPluginTests",
            dependencies: ["CapacitorDuckDbPlugin"],
            path: "ios/Tests/CapacitorDuckDbPluginTests")
    ]
)