import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

# read the dataset
df = pd.read_csv("../data/dataset.csv")

# split into X and y
X = df[["eye_distance_px", "face_height_px", "face_area_ratio", "head_tilt_h", "head_tilt_v"]]
y = df["label"]

# split into train and test
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# model RandomForest
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# predict on test set
y_pred = clf.predict(X_test)

# evaluate the model
print("Classification Report:")
print(classification_report(y_test, y_pred))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))
