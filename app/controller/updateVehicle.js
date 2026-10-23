// controllers/updateVehicleStatus.js
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");

exports.updateVehicleStatus = async (req, res) => {
  try {
    const { vehicleType, vehicleId, status } = req.body;

    if (!vehicleType || !vehicleId || !status) {
      return res.status(400).json({
        success: false,
        message: "Send vehicleType, vehicleId & status",
      });
    }

    // Select model based on vehicleType
    let Model;
    if (vehicleType === "Car") Model = Car;
    else if (vehicleType === "Bike") Model = Bike;
    else if (vehicleType === "Auto") Model = Auto;
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicleType. Use Car / Bike / Auto.",
      });
    }

    // Update the status
    const updated = await Model.findByIdAndUpdate(
      vehicleId,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle status updated successfully",
      data: updated,
    });

  } catch (error) {
    console.error("Error updating vehicle status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getPendingVehicles = async (req, res) => {
  try {
    const { vehicleType } = req.query;

    if (!vehicleType) {
      return res.status(400).json({
        success: false,
        message: "Send vehicleType as query param (Car/Bike/Auto)",
      });
    }

    // Select model dynamically
    let Model;
    if (vehicleType === "Car") Model = Car;
    else if (vehicleType === "Bike") Model = Bike;
    else if (vehicleType === "Auto") Model = Auto;
    else {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicleType. Use Car, Bike, or Auto.",
      });
    }

    // Fetch pending vehicles
    const vehicles = await Model.find({ status: "Pending" });

    if (vehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No pending vehicles found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pending vehicles fetched successfully",
      total: vehicles.length,
      data: vehicles,
    });

  } catch (error) {
    console.error("Error fetching pending vehicles:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
