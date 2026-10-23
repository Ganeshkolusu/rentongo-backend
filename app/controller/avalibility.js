const Availability = require("../model/avalibility");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");

const vehicleModelByType = { Car, Bike, Auto };

const assertOwnsVehicle = async (vechileType, VechileId, userId) => {
  const model = vehicleModelByType[vechileType];
  const vehicle = model ? await model.findById(VechileId) : null;
  return !!vehicle && vehicle.userId.toString() === userId;
};

// ✅ Create Availability
exports.createNotAvailability = async (req, res) => {
  try {
    const {  vechileType, VechileId, fromDate, toDate, fromTime, toTime, isNotAvailable } = req.body;

    // 🔹 Validation
    const requiredFields = [ "vechileType", "VechileId", "fromDate", "toDate", "fromTime", "toTime"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    if (!(await assertOwnsVehicle(vechileType, VechileId, req.userId))) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }

    const newAvailability = new Availability({
      vechileType,
      VechileId,
      fromDate,
      toDate,
      fromTime,
      toTime,
      isNotAvailable,
    });

    await newAvailability.save();
    res.status(201).json({ message: "Availability added successfully", data: newAvailability });
  } catch (error) {
    console.error("Error creating availability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Update Availability
exports.updateNotAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = await Availability.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Availability not found" });
    }

    if (!(await assertOwnsVehicle(existing.vechileType, existing.VechileId, req.userId))) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }

    const updatedAvailability = await Availability.findByIdAndUpdate(id, updates, { new: true });

    res.status(200).json({ message: "Availability updated successfully", data: updatedAvailability });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Delete Availability
exports.deleteNotAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Availability.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Availability not found" });
    }

    if (!(await assertOwnsVehicle(existing.vechileType, existing.VechileId, req.userId))) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }

    const deletedAvailability = await Availability.findByIdAndDelete(id);

    res.status(200).json({ message: "Availability deleted successfully" });
  } catch (error) {
    console.error("Error deleting availability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllNotAvailabilities = async (req, res) => {
  try {
    const { VechileId, vechileType, startDate, endDate } = req.query;

    // 🔹 Build dynamic filter
    const filter = {};

    if (VechileId) filter.VechileId = VechileId;
    if (vechileType) filter.vechileType = vechileType;

    // 🔹 Handle date range filtering
    if (startDate && endDate) {
      filter.$or = [
        {
          // Availability overlaps with given range
          fromDate: { $lte: new Date(endDate) },
          toDate: { $gte: new Date(startDate) },
        },
      ];
    } else if (startDate) {
      filter.fromDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.toDate = { $lte: new Date(endDate) };
    }

    // 🔹 Query database
    const availabilities = await Availability.find(filter).sort({ createdAt: -1 });

    if (availabilities.length === 0) {
      return res.status(404).json({ message: "No availabilities found for given filters" });
    }

    res.status(200).json({
      message: "Availabilities fetched successfully",
      count: availabilities.length,
      data: availabilities,
    });
  } catch (error) {
    console.error("Error fetching availabilities:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Get Availability by ID
exports.getNotAvailabilityById = async (req, res) => {
  try {
    const availability = await Availability.findById(req.params.id);
    if (!availability) {
      return res.status(404).json({ message: "Availability not found" });
    }
    res.status(200).json({ data: availability });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const Booking = require("../model/bookings");


// exports.getVehicleAvailability = async (req, res) => {
//   try {
//     const { VechileId, vechileType, startDate, endDate } = req.query;

//     // ✅ Check required fields
//     if (!VechileId || !vechileType) {
//       return res.status(400).json({
//         success: false,
//         message: "VechileId and vechileType are required",
//       });
//     }

//     // ✅ Parse dates
//     const start = startDate ? new Date(startDate) : new Date();
//     const end = endDate
//       ? new Date(endDate)
//       : new Date(new Date().setDate(start.getDate() + 7));

//     if (end < start) {
//       return res.status(400).json({
//         success: false,
//         message: "endDate must be after startDate",
//       });
//     }

//     // ✅ Fetch bookings excluding Cancelled and AutoCancelled
//     const bookings = await Booking.find({
//       VechileId,
//       vechileType,
//       status: { $nin: ["Cancelled", "AutoCancelled"] }, // 🚀 Only active bookings
//       FromDate: { $lte: end },
//       ToDate: { $gte: start },
//     }).select("FromDate ToDate FromTime ToTime status");

//     // ✅ Fetch manual not-availability records
//     const notAvailabilities = await Availability.find({
//       VechileId,
//       vechileType,
//       fromDate: { $lte: end },
//       toDate: { $gte: start },
//     }).select("fromDate toDate fromTime toTime");

//     // ✅ Combine unavailable slots
//     const unavailable = [
//       ...bookings.map((b) => ({
//         fromDate: b.FromDate,
//         toDate: b.ToDate,
//         fromTime: b.FromTime || "00:00",
//         toTime: b.ToTime || "23:59",
//         type: "Booking",
//       })),
//       ...notAvailabilities.map((a) => ({
//         fromDate: a.fromDate,
//         toDate: a.toDate,
//         fromTime: a.fromTime || "00:00",
//         toTime: a.toTime || "23:59",
//         type: "NotAvailable",
//       })),
//     ];

//     // ✅ Generate daily availability
//     const result = [];
//     const currentDate = new Date(start);

//     while (currentDate <= end) {
//       const dateStr = currentDate.toISOString().split("T")[0];

//       // Find slots affecting this date
//       const slotsForDate = unavailable
//         .filter((u) => {
//           const uStart = new Date(u.fromDate);
//           const uEnd = new Date(u.toDate);
//           return currentDate >= uStart && currentDate <= uEnd;
//         })
//         .map((u) => {
//           const currentStr = currentDate.toISOString().split("T")[0];
//           const fromStr = new Date(u.fromDate).toISOString().split("T")[0];
//           const toStr = new Date(u.toDate).toISOString().split("T")[0];

//           if (currentStr === fromStr && currentStr === toStr) {
//             return { fromTime: u.fromTime, toTime: u.toTime, type: u.type };
//           } else if (currentStr === fromStr) {
//             return { fromTime: u.fromTime, toTime: "23:59", type: u.type };
//           } else if (currentStr === toStr) {
//             return { fromTime: "00:00", toTime: u.toTime, type: u.type };
//           } else {
//             return { fromTime: "00:00", toTime: "23:59", type: u.type };
//           }
//         });

//       if (slotsForDate.length) {
//         result.push({
//           date: dateStr,
//           status: "Unavailable",
//           slots: slotsForDate,
//         });
//       } else {
//         result.push({
//           date: dateStr,
//           status: "Available",
//           slots: [{ fromTime: "00:00", toTime: "23:59" }],
//         });
//       }

//       currentDate.setDate(currentDate.getDate() + 1);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Vehicle availability fetched successfully",
//       availability: result,
//     });
//   } catch (error) {
//     console.error("Error fetching vehicle availability:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };



exports.getVehicleAvailability = async (req, res) => {
  try {
    const { VechileId, vechileType, startDate, endDate } = req.query;

    if (!VechileId || !vechileType) {
      return res.status(400).json({
        success: false,
        message: "VechileId and vechileType are required",
      });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : new Date(new Date().setDate(start.getDate() + 7));

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "endDate must be after startDate",
      });
    }

    const bookings = await Booking.find({
      VechileId,
      vechileType,
      status: { $nin: ["Cancelled", "AutoCancelled"] },
      FromDate: { $lte: end },
      ToDate: { $gte: start },
    }).select("_id FromDate ToDate FromTime ToTime status");

    const notAvailabilities = await Availability.find({
      VechileId,
      vechileType,
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }).select("_id fromDate toDate fromTime toTime");

    const unavailable = [
      ...bookings.map((b) => ({
        id: b._id,
        fromDate: b.FromDate,
        toDate: b.ToDate,
        fromTime: b.FromTime || "00:00",
        toTime: b.ToTime || "23:59",
        type: "Booking",
      })),
      ...notAvailabilities.map((a) => ({
        id: a._id,
        fromDate: a.fromDate,
        toDate: a.toDate,
        fromTime: a.fromTime || "00:00",
        toTime: a.toTime || "23:59",
        type: "NotAvailable",
      })),
    ];

    const result = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];

      const slotsForDate = unavailable
        .filter((u) => {
          const uStart = new Date(u.fromDate);
          const uEnd = new Date(u.toDate);
          return currentDate >= uStart && currentDate <= uEnd;
        })
        .map((u) => {
          const cur = currentDate.toISOString().split("T")[0];
          const uStart = new Date(u.fromDate).toISOString().split("T")[0];
          const uEnd = new Date(u.toDate).toISOString().split("T")[0];

          if (cur === uStart && cur === uEnd) {
            return { id: u.id, fromTime: u.fromTime, toTime: u.toTime, type: u.type };
          } else if (cur === uStart) {
            return { id: u.id, fromTime: u.fromTime, toTime: "23:59", type: u.type };
          } else if (cur === uEnd) {
            return { id: u.id, fromTime: "00:00", toTime: u.toTime, type: u.type };
          } else {
            return { id: u.id, fromTime: "00:00", toTime: "23:59", type: u.type };
          }
        });

      result.push(
        slotsForDate.length
          ? { date: dateStr, status: "Unavailable", slots: slotsForDate }
          : { date: dateStr, status: "Available", slots: [{ fromTime: "00:00", toTime: "23:59" }] }
      );

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle availability fetched successfully",
      availability: result,
    });
  } catch (error) {
    console.error("Error fetching vehicle availability:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


