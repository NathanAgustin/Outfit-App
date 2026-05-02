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

struct ClothingItem: Identifiable, Codable {
    var id = UUID()
    var name: String
    var category: ClothingCategory
    var imageData: Data
}

struct SavedOutfit: Identifiable, Codable {
    var id = UUID()
    var name: String
    var topID: UUID
    var bottomID: UUID
    var shoesID: UUID
    var accessoryIDs: [UUID]
    var previewImageData: Data? = nil
    var dateModified = Date()
}

struct ContentView: View {
    private let clothingItemsStorageKey = "clothing_items_v1"
    private let savedOutfitsStorageKey = "saved_outfits_v1"

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
    @State private var savedOutfits: [SavedOutfit] = []
    @State private var newOutfitName = ""
    @State private var loadedOutfitID: UUID?
    @State private var renameTargetID: UUID?
    @State private var renameDraft = ""
    @State private var isRenameAlertPresented = false
    @State private var previewImageTargetID: UUID?
    @State private var isPreviewSourceDialogPresented = false
    @State private var isOutfitImagePickerPresented = false
    @State private var outfitImagePickerSourceType: UIImagePickerController.SourceType = .photoLibrary

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
        .onAppear {
            loadClothingItems()
            loadSavedOutfits()
            normalizeSelectionState()
        }
    }

    private var closetTab: some View {
        NavigationStack {
            List {
                uploadSection
                closetSection
            }
            .navigationTitle("Closet")
            .scrollDismissesKeyboard(.interactively)
            .keyboardDismissToolbar()
            .sheet(item: $itemBeingEdited) { item in
                EditClothingItemView(item: item) { updatedItem in
                    if let index = clothingItems.firstIndex(where: { $0.id == updatedItem.id }) {
                        clothingItems[index] = updatedItem
                        normalizeSelectionState()
                        persistClothingItems()
                    }
                }
            }
        }
    }

    private var outfitManagerTab: some View {
        NavigationStack {
            List {
                Section {
                    outfitPreviewSection
                        .listRowInsets(EdgeInsets(top: 12, leading: 4, bottom: 12, trailing: 4))
                        .listRowBackground(Color.clear)
                }

                Section {
                    outfitBuildControlsSection
                }

                Section {
                    savedOutfitsSaveControls
                    if savedOutfits.isEmpty {
                        Text("No saved outfits yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(savedOutfits) { outfit in
                        savedOutfitRow(outfit)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button("Delete", role: .destructive) {
                                    deleteSavedOutfit(outfit.id)
                                }
                            }
                    }
                } header: {
                    Text("Saved Outfits")
                        .font(.title3.bold())
                        .textCase(nil)
                        .foregroundStyle(.primary)
                        .padding(.bottom, 2)
                }
            }
            .listStyle(.insetGrouped)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Outfit Manager")
            .keyboardDismissToolbar()
            .alert("Rename Outfit", isPresented: $isRenameAlertPresented) {
                TextField("Outfit name", text: $renameDraft)
                Button("Cancel", role: .cancel) {}
                Button("Save") {
                    renameSavedOutfit()
                }
            } message: {
                Text("Choose a new name for this outfit.")
            }
            .confirmationDialog("Set Preview Image", isPresented: $isPreviewSourceDialogPresented, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Take Photo") {
                        outfitImagePickerSourceType = .camera
                        isOutfitImagePickerPresented = true
                    }
                }

                Button("Choose From Library") {
                    outfitImagePickerSourceType = .photoLibrary
                    isOutfitImagePickerPresented = true
                }

                if let previewImageTargetID, hasCustomPreviewImage(for: previewImageTargetID) {
                    Button("Use Top Image", role: .destructive) {
                        setCustomPreviewImage(nil, for: previewImageTargetID)
                    }
                }

                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Use a custom photo or keep the preview synced to the top item image.")
            }
            .sheet(isPresented: $isOutfitImagePickerPresented) {
                OutfitImagePicker(sourceType: outfitImagePickerSourceType) { image in
                    guard let image, let previewImageTargetID else { return }
                    let rawData = image.jpegData(compressionQuality: 0.95)
                    let processedData = rawData.flatMap { downsampledJPEGData(from: $0) }
                    setCustomPreviewImage(processedData, for: previewImageTargetID)
                }
                .ignoresSafeArea()
            }
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
                VStack(spacing: 16) {
                    outfitLayerCard(
                        title: "Top",
                        item: selectedItem(for: .tops, index: topIndex),
                        widthRatio: 0.94
                    )

                    outfitLayerCard(
                        title: "Bottom",
                        item: selectedItem(for: .bottoms, index: bottomIndex),
                        widthRatio: 0.94
                    )

                    outfitLayerCard(
                        title: "Shoes",
                        item: selectedItem(for: .shoes, index: shoesIndex),
                        widthRatio: 0.94
                    )
                }
                .frame(maxWidth: .infinity)
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

            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                if let item, let image = UIImage(data: item.imageData) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: 160)
                } else {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.thinMaterial)
                        .frame(height: 160)
                        .overlay {
                            Text("No item")
                                .foregroundStyle(.secondary)
                        }
                }

                Text(displayName(for: item))
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)
            }
            .padding(14)
            .frame(width: width, height: 230)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(.white.opacity(0.35), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.10), radius: 8, y: 3)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .frame(height: 230)
    }

    private var outfitBuildControlsSection: some View {
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
        .padding(.vertical, 4)
    }

    private var savedOutfitsSaveControls: some View {
        Group {
            HStack(spacing: 8) {
                TextField("Outfit name", text: $newOutfitName)
                    .textInputAutocapitalization(.words)
                    .textFieldStyle(.roundedBorder)

                Button("Save") {
                    saveCurrentOutfit()
                }
                .buttonStyle(.borderedProminent)
                .disabled(currentSelectionIDs() == nil || trimmedNewOutfitName.isEmpty)
            }

            if let loadedOutfitID {
                Button("Update Loaded Outfit") {
                    updateLoadedOutfit(loadedOutfitID)
                }
                .buttonStyle(.bordered)
                .disabled(currentSelectionIDs() == nil)
            }
        }
    }

    @ViewBuilder
    private func savedOutfitRow(_ outfit: SavedOutfit) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                Group {
                    if let previewImage = previewImage(for: outfit) {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                    } else {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(.thinMaterial)
                            .overlay {
                                Image(systemName: "photo")
                                    .foregroundStyle(.secondary)
                            }
                    }
                }
                .frame(width: 62, height: 62)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 2) {
                    Text(outfit.name)
                        .font(.headline)
                    Text("Top: \(itemName(for: outfit.topID))  Bottom: \(itemName(for: outfit.bottomID))  Shoes: \(itemName(for: outfit.shoesID))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 4)

                if loadedOutfitID == outfit.id {
                    Text("Loaded")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.green.opacity(0.15), in: Capsule())
                        .foregroundStyle(.green)
                }
            }

            HStack(spacing: 8) {
                Button("Load") {
                    loadOutfit(outfit)
                }
                .buttonStyle(.borderedProminent)

                Button("Rename") {
                    renameTargetID = outfit.id
                    renameDraft = outfit.name
                    isRenameAlertPresented = true
                }
                .buttonStyle(.bordered)

                Button("Preview") {
                    previewImageTargetID = outfit.id
                    isPreviewSourceDialogPresented = true
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.vertical, 4)
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
        persistClothingItems()
    }

    private func deleteItem(_ item: ClothingItem) {
        clothingItems.removeAll { $0.id == item.id }
        selectedAccessoryIDs.remove(item.id)
        normalizeSelectionState()
        persistClothingItems()
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
        pruneSavedOutfits()
    }

    private func normalized(index: Int, itemCount: Int) -> Int {
        guard itemCount > 0 else { return 0 }
        return min(index, itemCount - 1)
    }

    private var trimmedNewOutfitName: String {
        newOutfitName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func currentSelectionIDs() -> (topID: UUID, bottomID: UUID, shoesID: UUID, accessoryIDs: [UUID])? {
        guard
            let top = selectedItem(for: .tops, index: topIndex),
            let bottom = selectedItem(for: .bottoms, index: bottomIndex),
            let shoes = selectedItem(for: .shoes, index: shoesIndex)
        else {
            return nil
        }

        let validAccessoryIDs = Set(items(for: .accessories).map(\.id))
        let accessories = selectedAccessoryIDs.intersection(validAccessoryIDs)
        return (top.id, bottom.id, shoes.id, Array(accessories))
    }

    private func saveCurrentOutfit() {
        guard let selection = currentSelectionIDs(), !trimmedNewOutfitName.isEmpty else { return }

        let newSavedOutfit = SavedOutfit(
            name: trimmedNewOutfitName,
            topID: selection.topID,
            bottomID: selection.bottomID,
            shoesID: selection.shoesID,
            accessoryIDs: selection.accessoryIDs,
            dateModified: Date()
        )
        savedOutfits.insert(newSavedOutfit, at: 0)
        loadedOutfitID = newSavedOutfit.id
        newOutfitName = ""
        persistSavedOutfits()
    }

    private func updateLoadedOutfit(_ id: UUID) {
        guard let selection = currentSelectionIDs(),
              let index = savedOutfits.firstIndex(where: { $0.id == id }) else { return }

        savedOutfits[index].topID = selection.topID
        savedOutfits[index].bottomID = selection.bottomID
        savedOutfits[index].shoesID = selection.shoesID
        savedOutfits[index].accessoryIDs = selection.accessoryIDs
        savedOutfits[index].dateModified = Date()
        persistSavedOutfits()
    }

    private func loadOutfit(_ outfit: SavedOutfit) {
        let tops = items(for: .tops)
        let bottoms = items(for: .bottoms)
        let shoes = items(for: .shoes)
        let accessoryIDs = Set(items(for: .accessories).map(\.id))

        guard
            let newTopIndex = tops.firstIndex(where: { $0.id == outfit.topID }),
            let newBottomIndex = bottoms.firstIndex(where: { $0.id == outfit.bottomID }),
            let newShoesIndex = shoes.firstIndex(where: { $0.id == outfit.shoesID })
        else {
            return
        }

        topIndex = newTopIndex
        bottomIndex = newBottomIndex
        shoesIndex = newShoesIndex
        selectedAccessoryIDs = Set(outfit.accessoryIDs).intersection(accessoryIDs)
        loadedOutfitID = outfit.id
    }

    private func renameSavedOutfit() {
        let trimmedName = renameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty,
              let renameTargetID,
              let index = savedOutfits.firstIndex(where: { $0.id == renameTargetID }) else {
            return
        }

        savedOutfits[index].name = trimmedName
        savedOutfits[index].dateModified = Date()
        persistSavedOutfits()
    }

    private func deleteSavedOutfit(_ id: UUID) {
        savedOutfits.removeAll { $0.id == id }
        if loadedOutfitID == id {
            loadedOutfitID = nil
        }
        if previewImageTargetID == id {
            previewImageTargetID = nil
        }
        persistSavedOutfits()
    }

    private func loadSavedOutfits() {
        guard let data = UserDefaults.standard.data(forKey: savedOutfitsStorageKey),
              let decoded = try? JSONDecoder().decode([SavedOutfit].self, from: data) else {
            return
        }
        savedOutfits = decoded.sorted(by: { $0.dateModified > $1.dateModified })
    }

    private func loadClothingItems() {
        guard let data = UserDefaults.standard.data(forKey: clothingItemsStorageKey),
              let decoded = try? JSONDecoder().decode([ClothingItem].self, from: data) else {
            return
        }
        clothingItems = decoded
    }

    private func persistClothingItems() {
        guard let encoded = try? JSONEncoder().encode(clothingItems) else { return }
        UserDefaults.standard.set(encoded, forKey: clothingItemsStorageKey)
    }

    private func persistSavedOutfits() {
        savedOutfits.sort(by: { $0.dateModified > $1.dateModified })
        guard let encoded = try? JSONEncoder().encode(savedOutfits) else { return }
        UserDefaults.standard.set(encoded, forKey: savedOutfitsStorageKey)
    }

    private func pruneSavedOutfits() {
        let categoryByID = Dictionary(uniqueKeysWithValues: clothingItems.map { ($0.id, $0.category) })
        let loadedIDBeforePrune = loadedOutfitID

        savedOutfits = savedOutfits.compactMap { outfit in
            guard categoryByID[outfit.topID] == .tops,
                  categoryByID[outfit.bottomID] == .bottoms,
                  categoryByID[outfit.shoesID] == .shoes else {
                return nil
            }

            var cleaned = outfit
            cleaned.accessoryIDs = cleaned.accessoryIDs.filter { categoryByID[$0] == .accessories }
            return cleaned
        }

        if let loadedIDBeforePrune, !savedOutfits.contains(where: { $0.id == loadedIDBeforePrune }) {
            loadedOutfitID = nil
        }

        persistSavedOutfits()
    }

    private func itemName(for id: UUID) -> String {
        guard let item = clothingItems.first(where: { $0.id == id }) else { return "Missing item" }
        return displayName(for: item)
    }

    private func previewImage(for outfit: SavedOutfit) -> UIImage? {
        if let previewImageData = outfit.previewImageData, let previewImage = UIImage(data: previewImageData) {
            return previewImage
        }

        guard let topItem = clothingItems.first(where: { $0.id == outfit.topID }) else { return nil }
        return UIImage(data: topItem.imageData)
    }

    private func hasCustomPreviewImage(for outfitID: UUID) -> Bool {
        guard let outfit = savedOutfits.first(where: { $0.id == outfitID }) else { return false }
        return outfit.previewImageData != nil
    }

    private func setCustomPreviewImage(_ imageData: Data?, for outfitID: UUID) {
        guard let index = savedOutfits.firstIndex(where: { $0.id == outfitID }) else { return }
        savedOutfits[index].previewImageData = imageData
        savedOutfits[index].dateModified = Date()
        persistSavedOutfits()
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
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button {
                        resignFirstResponder()
                    } label: {
                        Image(systemName: "keyboard.chevron.compact.down")
                            .imageScale(.large)
                    }
                    .accessibilityLabel("Dismiss keyboard")
                }
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

private func resignFirstResponder() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}

private extension View {
    func keyboardDismissToolbar() -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button {
                    resignFirstResponder()
                } label: {
                    Image(systemName: "keyboard.chevron.compact.down")
                        .imageScale(.large)
                }
                .accessibilityLabel("Dismiss keyboard")
            }
        }
    }
}

#Preview {
    ContentView()
}

struct OutfitImagePicker: UIViewControllerRepresentable {
    typealias UIViewControllerType = UIImagePickerController

    let sourceType: UIImagePickerController.SourceType
    let onImagePicked: (UIImage?) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator {
        Coordinator(onImagePicked: onImagePicked, dismiss: dismiss)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        private let onImagePicked: (UIImage?) -> Void
        private let dismiss: DismissAction

        init(onImagePicked: @escaping (UIImage?) -> Void, dismiss: DismissAction) {
            self.onImagePicked = onImagePicked
            self.dismiss = dismiss
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onImagePicked(nil)
            dismiss()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let image = info[.originalImage] as? UIImage
            onImagePicked(image)
            dismiss()
        }
    }
}
