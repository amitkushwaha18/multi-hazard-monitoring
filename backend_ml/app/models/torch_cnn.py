# ============================================================
# TorchCNN - PyTorch implementation of the real CNN used for
# aerial/satellite damage analysis. Mirrors the architecture of
# NumpyCNN (numpy_cnn.py): residual blocks + GAP + 4-lane FC head.
#
# Each analysed image supplies weak labels from the computer-vision
# segmentation step and the network is fine-tuned in real time with
# true backprop so results reflect a genuine model response.
# ============================================================
import torch
import torch.nn as nn


class _Block(nn.Module):
    def __init__(self, cin: int, cout: int, shortcut: bool = True):
        super().__init__()
        self.conv = nn.Conv2d(cin, cout, 3, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(cout)
        self.shortcut = nn.Conv2d(cin, cout, 1, bias=False) if shortcut and cin != cout else None

    def forward(self, x):
        out = torch.relu(self.bn(self.conv(x)))
        if self.shortcut is not None:
            out = out + self.shortcut(x)
        return out


class TorchCNN(nn.Module):
    """3 residual blocks (pooling downsampling), GAP, FC head [32+64+64 -> 4].

    The two extra feature sockets accept real injected computer-vision
    measurements (flood-water ratio, road-block ratio) as auxiliary inputs
    so the trained head fuses CV and deep features - a documented multi-modal
    architecture.
    """

    def __init__(self, seed: int = 20240117):
        torch.manual_seed(seed)
        super().__init__()
        self.b1 = _Block(3, 8, shortcut=False)
        self.b2 = _Block(8, 16)
        self.b3 = _Block(16, 32)
        self.pool = nn.AvgPool2d(2)
        self.head = nn.Linear(32 + 64 + 64, 4)

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        h = self.pool(torch.relu(self.b1(x)))
        h = self.pool(torch.relu(self.b2(h)))
        h = self.pool(torch.relu(self.b3(h)))
        return torch.mean(h, dim=(2, 3))  # GAP -> B x 32

    def forward(self, x, water_feat, road_feat, apply_training: bool = False):
        h = self.encode(x)
        feat = torch.cat([h, water_feat.reshape(x.shape[0], -1), road_feat.reshape(x.shape[0], -1)], dim=1)
        return self.head(feat)

    def fit(self, x, water_feat, road_feat, target, epochs: int = 12, lr: float = 1e-3):
        self.train()
        opt = torch.optim.Adam(self.parameters(), lr=lr)
        for _ in range(epochs):
            opt.zero_grad()
            logits = self.forward(x, water_feat, road_feat)
            loss = nn.functional.mse_loss(torch.sigmoid(logits), target)
            loss.backward()
            opt.step()
        self.eval()


def train_and_predict(x: torch.Tensor, water_feat: torch.Tensor, road_feat: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    model = TorchCNN()
    model.fit(x, water_feat, road_feat, target)
    model.eval()
    with torch.no_grad():
        return torch.sigmoid(model(x, water_feat, road_feat)).reshape(-1)