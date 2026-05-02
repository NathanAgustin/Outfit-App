//
//  ContentView.swift
//  Outfit App
//where 
//  Created by Nathan Agustin on 4/25/26.
//

import ImageIO
import PhotosUI
import SwiftUI
import UIKit

enum ClothingCategory: String, CaseIterable, Codable, Identifiable {
    case tops = "Tops"
    case bottoms = "Bottoms"
    case shoes = "Shoes"
    case accessories = "Accessories"

    var id: String { rawValue }
}

struct ClothingItem: Identifiable {
    var id = UUID()
    var name: String
    var category: ClothingCategory
    var imageData: Data
}

struct ContentView: View {
    @State private var clothingItems: [ClothingItem] = []
    @State private var selectedCategory: ClothingCategory = .tops
    @State private var itemName = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @State private var itemBeingEdited: ClothingItem?
    @State private var topIndex = 0
    @State private var bottomIndex = 0
    @State private var shoesIndex = 0
    @State private var selectedAccessoryIDs: Set<UUID> = []

    var body: some View {
        TabView {
            closetTab
                .tabItem {
                    Label("Closet", systemImage: "tshirt")
                }

            outfitManagerTab
                .tabItem {
                    Label("Outfit Manager", systemImage: "person.crop.rectangle.stack")
                }
        }
    }

    private var closetTab: some View {
        NavigationStack {
            List {
                uploadSection
                closetSection
            }
            .navigationTitle("Closet")
            .sheet(item: $itemBeingEdited) { item in
                EditClothingItemView(item: item) { updatedItem in
                    if let index = clothingItems.firstIndex(where: { $0.id == updatedItem.id }) {
                        clothingItems[index] = updatedItem
                        normalizeSelectionState()
                    }
                }
            }
        }
    }

    private var outfitManagerTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    outfitPreviewSection
                    outfitControlsSection
                }
                .padding()
            }
            .navigationTitle("Outfit Manager")
        }
    }

    private var outfitPreviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Outfit Preview")
                .font(.title3.bold())

            if items(for: .tops).isEmpty || items(for: .bottoms).isEmpty || items(for: .shoes).isEmpty {
                Text("Add at least one top, bottom, and shoes in Closet to preview a full outfit.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
            } else {
                ZStack(alignment: .top) {
                    outfitLayerCard(
                        title: "Shoes",
                        item: selectedItem(for: .shoes, index: shoesIndex),
                        widthRatio: 0.72
                    )
                    .offset(y: 270)

                    outfitLayerCard(
                        title: "Bottom",
                        item: selectedItem(for: .bottoms, index: bottomIndex),
                        widthRatio: 0.82
                    )
                    .offset(y: 140)

                    outfitLayerCard(
                        title: "Top",
                        item: selectedItem(for: .tops, index: topIndex),
                        widthRatio: 0.92
                    )
                }
                .frame(maxWidth: .infinity)
                .frame(height: 420)
                .padding(.vertical, 8)
            }

            selectedAccessoriesPreview
        }
    }

    private var selectedAccessoriesPreview: some View {
        let accessories = items(for: .accessories).filter { selectedAccessoryIDs.contains($0.id) }

        return VStack(alignment: .leading, spacing: 8) {
            Text("Selected Accessories")
                .font(.headline)

            if accessories.isEmpty {
                Text("No accessories selected.")
                    .foregroundStyle(.secondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(accessories) { item in
                            VStack(spacing: 6) {
                                if let image = UIImage(data: item.imageData) {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 72, height: 72)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }

                                Text(displayName(for: item))
                                    .font(.caption)
                                    .lineLimit(1)
                            }
                            .frame(width: 82)
                        }
                    }
                }
            }
        }
    }

    private func outfitLayerCard(title: String, item: ClothingItem?, widthRatio: CGFloat) -> some View {
        GeometryReader { proxy in
            let width = proxy.size.width * widthRatio

            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let item, let image = UIImage(data: item.imageData) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: 120)
                } else {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(.thinMaterial)
                        .frame(height: 120)
                        .overlay {
                            Text("No item")
                                .foregroundStyle(.secondary)
                        }
                }

                Text(displayName(for: item))
                    .font(.headline)
                    .lineLimit(1)
            }
            .padding()
            .frame(width: width, height: 190)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(.white.opacity(0.45), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .frame(height: 190)
    }

    private var outfitControlsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            categorySelectorRow(
                title: "Top",
                items: items(for: .tops),
                selectedIndex: $topIndex
            )

            categorySelectorRow(
                title: "Bottom",
                items: items(for: .bottoms),
                selectedIndex: $bottomIndex
            )

            categorySelectorRow(
                title: "Shoes",
                items: items(for: .shoes),
                selectedIndex: $shoesIndex
            )

            accessoriesSelector
        }
    }

    private var uploadSection: some View {
        Section("Add Clothing Item") {
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Label("Select Photo", systemImage: "photo.on.rectangle")
            }
            .onChange(of: selectedPhoto) { _, newValue in
                guard let newValue else { return }
                Task {
                    guard let rawData = try? await newValue.loadTransferable(type: Data.self) else {
                        selectedImageData = nil
                        return
                    }
                    selectedImageData = downsampledJPEGData(from: rawData)
                }
            }

            if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            TextField("Item name (optional)", text: $itemName)
                .textInputAutocapitalization(.words)

            Picker("Category", selection: $selectedCategory) {
                ForEach(ClothingCategory.allCases) { category in
                    Text(category.rawValue).tag(category)
                }
            }

            Button("Add Item") {
                addItem()
            }
            .buttonStyle(.borderedProminent)
            .disabled(selectedImageData == nil)
        }
    }

    private var closetSection: some View {
        Section("My Closet") {
            if clothingItems.isEmpty {
                Text("No items yet. Add your first clothing item above.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(ClothingCategory.allCases) { category in
                    let itemsForCategory = clothingItems.filter { $0.category == category }

                    if !itemsForCategory.isEmpty {
                        Section(category.rawValue) {
                            ForEach(itemsForCategory) { item in
                                HStack(spacing: 12) {
                                    if let uiImage = UIImage(data: item.imageData) {
                                        Image(uiImage: uiImage)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 50, height: 50)
                                            .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }

                                    VStack(alignment: .leading) {
                                        Text(item.name.isEmpty ? "Unnamed Item" : item.name)
                                            .font(.headline)
                                        Text(item.category.rawValue)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .swipeActions {
                                    Button("Delete", role: .destructive) {
                                        deleteItem(item)
                                    }
                                    Button("Edit") {
                                        itemBeingEdited = item
                                    }
                                    .tint(.blue)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private var accessoriesSelector: some View {
        let accessories = items(for: .accessories)

        return Group {
            if accessories.isEmpty {
                Text("No accessories available yet.")
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Accessories (multiple)")
                        .font(.headline)

                    ForEach(accessories) { item in
                        Button {
                            toggleAccessory(item.id)
                        } label: {
                            HStack(spacing: 12) {
                                if let uiImage = UIImage(data: item.imageData) {
                                    Image(uiImage: uiImage)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 44, height: 44)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }

                                Text(displayName(for: item))
                                    .foregroundStyle(.primary)

                                Spacer()

                                Image(systemName: selectedAccessoryIDs.contains(item.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selectedAccessoryIDs.contains(item.id) ? .green : .secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    @ViewBuilder
    private func categorySelectorRow(
        title: String,
        items: [ClothingItem],
        selectedIndex: Binding<Int>
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)

            if items.isEmpty {
                Text("No \(title.lowercased()) items available.")
                    .foregroundStyle(.secondary)
            } else {
                HStack(spacing: 12) {
                    Button {
                        moveSelectionLeft(index: selectedIndex, count: items.count)
                    } label: {
                        Image(systemName: "chevron.left")
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.bordered)

                    HStack(spacing: 12) {
                        if let uiImage = UIImage(data: items[selectedIndex.wrappedValue].imageData) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 56, height: 56)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(displayName(for: items[selectedIndex.wrappedValue]))
                                .font(.subheadline)
                            Text("\(selectedIndex.wrappedValue + 1) of \(items.count)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()
                    }

                    Button {
                        moveSelectionRight(index: selectedIndex, count: items.count)
                    } label: {
                        Image(systemName: "chevron.right")
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func addItem() {
        guard let imageData = selectedImageData else { return }
        let newItem = ClothingItem(
            name: itemName.trimmingCharacters(in: .whitespacesAndNewlines),
            category: selectedCategory,
            imageData: imageData
        )
        clothingItems.append(newItem)
        itemName = ""
        selectedImageData = nil
        selectedPhoto = nil
        selectedCategory = .tops
        normalizeSelectionState()
    }

    private func deleteItem(_ item: ClothingItem) {
        clothingItems.removeAll { $0.id == item.id }
        selectedAccessoryIDs.remove(item.id)
        normalizeSelectionState()
    }

    private func items(for category: ClothingCategory) -> [ClothingItem] {
        clothingItems.filter { $0.category == category }
    }

    private func displayName(for item: ClothingItem) -> String {
        item.name.isEmpty ? "Unnamed Item" : item.name
    }

    private func displayName(for item: ClothingItem?) -> String {
        guard let item else { return "No selection" }
        return displayName(for: item)
    }

    private func selectedItem(for category: ClothingCategory, index: Int) -> ClothingItem? {
        let categoryItems = items(for: category)
        guard !categoryItems.isEmpty else { return nil }
        let safeIndex = min(max(index, 0), categoryItems.count - 1)
        return categoryItems[safeIndex]
    }

    private func moveSelectionLeft(index: Binding<Int>, count: Int) {
        guard count > 0 else { return }
        index.wrappedValue = (index.wrappedValue - 1 + count) % count
    }

    private func moveSelectionRight(index: Binding<Int>, count: Int) {
        guard count > 0 else { return }
        index.wrappedValue = (index.wrappedValue + 1) % count
    }

    private func toggleAccessory(_ accessoryID: UUID) {
        if selectedAccessoryIDs.contains(accessoryID) {
            selectedAccessoryIDs.remove(accessoryID)
        } else {
            selectedAccessoryIDs.insert(accessoryID)
        }
    }

    private func normalizeSelectionState() {
        let tops = items(for: .tops)
        let bottoms = items(for: .bottoms)
        let shoes = items(for: .shoes)
        let accessories = Set(items(for: .accessories).map(\.id))

        topIndex = normalized(index: topIndex, itemCount: tops.count)
        bottomIndex = normalized(index: bottomIndex, itemCount: bottoms.count)
        shoesIndex = normalized(index: shoesIndex, itemCount: shoes.count)
        selectedAccessoryIDs = selectedAccessoryIDs.intersection(accessories)
    }

    private func normalized(index: Int, itemCount: Int) -> Int {
        guard itemCount > 0 else { return 0 }
        return min(index, itemCount - 1)
    }

    private func downsampledJPEGData(from rawData: Data) -> Data? {
        let sourceOptions: CFDictionary = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(rawData as CFData, sourceOptions) else {
            return nil
        }

        let maxDimensionInPixels: CGFloat = 1400
        let downsampleOptions: CFDictionary = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: false,
            kCGImageSourceThumbnailMaxPixelSize: maxDimensionInPixels
        ] as CFDictionary

        guard let scaledImage = CGImageSourceCreateThumbnailAtIndex(source, 0, downsampleOptions) else {
            return nil
        }

        let image = UIImage(cgImage: scaledImage)
        return image.jpegData(compressionQuality: 0.78)
    }
}

struct EditClothingItemView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var editedName: String
    @State private var editedCategory: ClothingCategory
    let originalItem: ClothingItem
    let onSave: (ClothingItem) -> Void

    init(item: ClothingItem, onSave: @escaping (ClothingItem) -> Void) {
        originalItem = item
        self.onSave = onSave
        _editedName = State(initialValue: item.name)
        _editedCategory = State(initialValue: item.category)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item Details") {
                    TextField("Item name", text: $editedName)
                        .textInputAutocapitalization(.words)

                    Picker("Category", selection: $editedCategory) {
                        ForEach(ClothingCategory.allCases) { category in
                            Text(category.rawValue).tag(category)
                        }
                    }
                }
            }
            .navigationTitle("Edit Item")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let updatedItem = ClothingItem(
                            id: originalItem.id,
                            name: editedName.trimmingCharacters(in: .whitespacesAndNewlines),
                            category: editedCategory,
                            imageData: originalItem.imageData
                        )
                        onSave(updatedItem)
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
