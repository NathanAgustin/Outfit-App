//
//  ContentView.swift
//  Outfit App
//
//  Created by Nathan Agustin on 4/25/26.
//

import SwiftUI

struct ContentView: View {
    @State private var selection: String? = nil

    var body: some View {
        VStack(spacing: 16) {
            Text("Select an option:")
                .font(.headline)

            HStack(spacing: 12) {
                Button("Yes") {
                    selection = "Yes"
                }
                .buttonStyle(.borderedProminent)

                Button("No") {
                    selection = "No"
                }
                .buttonStyle(.bordered)
            }

            Text("Selected: \(selection ?? "None")")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
